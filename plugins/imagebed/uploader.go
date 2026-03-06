package imagebed

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

const (
	githubAPIBaseURL = "https://api.github.com"
	jsDelivrBaseURL  = "https://cdn.jsdelivr.net/gh"
)

// Uploader handles GitHub image uploads
type Uploader struct {
	config *ImageBedConfig
	client *http.Client
}

// NewUploader creates a new uploader instance
func NewUploader(config *ImageBedConfig) *Uploader {
	return &Uploader{
		config: config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Upload uploads an image to GitHub repository
func (u *Uploader) Upload(fileName string, content []byte) (*UploadRecord, error) {
	if err := u.validateConfig(); err != nil {
		return nil, err
	}

	// Clean and prepare the file path
	uploadPath := u.buildUploadPath(fileName)

	// Upload to GitHub
	githubResp, err := u.uploadToGitHub(uploadPath, content)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to GitHub: %w", err)
	}

	// Build URLs
	originalURL := u.buildGitHubRawURL(uploadPath)
	cdnURL := u.buildJsDelivrURL(uploadPath)

	record := &UploadRecord{
		FileName:    fileName,
		OriginalURL: originalURL,
		CDNURL:      cdnURL,
		Size:        int64(githubResp.Content.Size),
		Path:        uploadPath,
		Sha:         githubResp.Content.Sha,
	}

	return record, nil
}

// Delete deletes a file from GitHub repository
func (u *Uploader) Delete(filePath, sha string) error {
	if err := u.validateConfig(); err != nil {
		return err
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s",
		githubAPIBaseURL,
		url.PathEscape(u.config.Owner),
		url.PathEscape(u.config.Repo),
		url.PathEscape(filePath))

	requestBody := map[string]string{
		"message": fmt.Sprintf("Delete image: %s", path.Base(filePath)),
		"sha":     sha,
		"branch":  u.getBranch(),
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodDelete, apiURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ValidateConfig validates the GitHub configuration by making a test API call
func (u *Uploader) ValidateConfig() (*ConfigValidationResult, error) {
	if err := u.validateConfig(); err != nil {
		return &ConfigValidationResult{
			Valid:   false,
			Message: err.Error(),
		}, nil
	}

	// Test API access by getting repo info
	apiURL := fmt.Sprintf("%s/repos/%s/%s",
		githubAPIBaseURL,
		url.PathEscape(u.config.Owner),
		url.PathEscape(u.config.Repo))

	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return &ConfigValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("Failed to create request: %v", err),
		}, nil
	}

	req.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.client.Do(req)
	if err != nil {
		return &ConfigValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("Failed to connect to GitHub API: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		// Parse repo info to get default branch
		var repoInfo struct {
			DefaultBranch string `json:"default_branch"`
			Name          string `json:"name"`
			Private       bool   `json:"private"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&repoInfo); err == nil {
			// Check if configured branch exists
			configuredBranch := u.getBranch()
			if configuredBranch != repoInfo.DefaultBranch {
				// Try to verify the configured branch exists
				branchURL := fmt.Sprintf("%s/repos/%s/%s/branches/%s",
					githubAPIBaseURL,
					url.PathEscape(u.config.Owner),
					url.PathEscape(u.config.Repo),
					url.PathEscape(configuredBranch))

				branchReq, _ := http.NewRequest(http.MethodGet, branchURL, nil)
				branchReq.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
				branchReq.Header.Set("Accept", "application/vnd.github+json")
				branchReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")

				branchResp, err := u.client.Do(branchReq)
				if err != nil || branchResp.StatusCode != http.StatusOK {
					if branchResp != nil {
						branchResp.Body.Close()
					}
					return &ConfigValidationResult{
						Valid:   false,
						Message: fmt.Sprintf("分支 '%s' 不存在。仓库默认分支是 '%s'", configuredBranch, repoInfo.DefaultBranch),
					}, nil
				}
				branchResp.Body.Close()
			}

			return &ConfigValidationResult{
				Valid:   true,
				Message: fmt.Sprintf("配置有效 (仓库: %s, 分支: %s, %s)", repoInfo.Name, configuredBranch, map[bool]string{true: "私有", false: "公开"}[repoInfo.Private]),
			}, nil
		}
		return &ConfigValidationResult{
			Valid:   true,
			Message: "配置有效",
		}, nil
	case http.StatusUnauthorized:
		return &ConfigValidationResult{
			Valid:   false,
			Message: "Invalid GitHub token",
		}, nil
	case http.StatusNotFound:
		return &ConfigValidationResult{
			Valid:   false,
			Message: "Repository not found or you don't have access",
		}, nil
	default:
		body, _ := io.ReadAll(resp.Body)
		return &ConfigValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("GitHub API returned %d: %s", resp.StatusCode, string(body)),
		}, nil
	}
}

// validateConfig checks if the configuration is valid
func (u *Uploader) validateConfig() error {
	if u.config.GitHubToken == "" {
		return fmt.Errorf("GitHub token is required")
	}
	if u.config.Owner == "" {
		return fmt.Errorf("repository owner is required")
	}
	if u.config.Repo == "" {
		return fmt.Errorf("repository name is required")
	}
	return nil
}

// buildUploadPath builds the full path for the uploaded file
func (u *Uploader) buildUploadPath(fileName string) string {
	basePath := strings.Trim(u.config.Path, "/")
	if basePath == "" {
		basePath = "images"
	}
	// Add timestamp prefix to avoid conflicts
	timestamp := time.Now().Format("20060102")
	return fmt.Sprintf("%s/%s/%s", basePath, timestamp, fileName)
}

// uploadToGitHub uploads content to GitHub using the Contents API
func (u *Uploader) uploadToGitHub(filePath string, content []byte) (*GitHubUploadResponse, error) {
	apiURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s",
		githubAPIBaseURL,
		url.PathEscape(u.config.Owner),
		url.PathEscape(u.config.Repo),
		url.PathEscape(filePath))

	// Encode content to base64
	encodedContent := base64.StdEncoding.EncodeToString(content)

	requestBody := map[string]string{
		"message": fmt.Sprintf("Upload image: %s", path.Base(filePath)),
		"content": encodedContent,
		"branch":  u.getBranch(),
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPut, apiURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusCreated {
		// Try to parse error response
		var errorResp GitHubErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return nil, fmt.Errorf("GitHub API error: %s", errorResp.Message)
		}
		return nil, fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	var result GitHubUploadResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// buildGitHubRawURL builds the GitHub raw content URL
func (u *Uploader) buildGitHubRawURL(filePath string) string {
	return fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s/%s",
		u.config.Owner,
		u.config.Repo,
		u.getBranch(),
		filePath)
}

// buildJsDelivrURL builds the jsDelivr CDN URL
func (u *Uploader) buildJsDelivrURL(filePath string) string {
	return fmt.Sprintf("%s/%s/%s@%s/%s",
		jsDelivrBaseURL,
		u.config.Owner,
		u.config.Repo,
		u.getBranch(),
		filePath)
}

// getBranch returns the configured branch or default
func (u *Uploader) getBranch() string {
	if u.config.Branch == "" {
		return "main"
	}
	return u.config.Branch
}

// GitHubFile represents a file in GitHub repository
type GitHubFile struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	SHA         string `json:"sha"`
	Size        int    `json:"size"`
	Type        string `json:"type"` // "file" or "dir"
	DownloadURL string `json:"download_url"`
}

// GitHubTreeItem represents an item in a Git tree
type GitHubTreeItem struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"` // "blob", "tree", "commit"
	SHA  string `json:"sha"`
	Size int    `json:"size,omitempty"`
}

// GitHubTreeResponse represents the response from Git Tree API
type GitHubTreeResponse struct {
	SHA       string           `json:"sha"`
	URL       string           `json:"url"`
	Tree      []GitHubTreeItem `json:"tree"`
	Truncated bool             `json:"truncated"`
}

// ListRepositoryImages lists all images in the configured path (including subdirectories)
func (u *Uploader) ListRepositoryImages() ([]UploadRecord, error) {
	if err := u.validateConfig(); err != nil {
		return nil, err
	}

	// Use Git Tree API to get all files recursively
	// This is more efficient than multiple Contents API calls
	apiURL := fmt.Sprintf("%s/repos/%s/%s/git/trees/%s?recursive=1",
		githubAPIBaseURL,
		url.PathEscape(u.config.Owner),
		url.PathEscape(u.config.Repo),
		url.QueryEscape(u.getBranch()))

	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errorResp GitHubErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return nil, fmt.Errorf("GitHub API error: %s", errorResp.Message)
		}
		return nil, fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	// Parse tree response
	var treeResp GitHubTreeResponse
	if err := json.Unmarshal(body, &treeResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Filter image files and convert to UploadRecord
	var records []UploadRecord
	imageExtensions := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".svg":  true,
		".bmp":  true,
		".ico":  true,
	}

	// Normalize the configured path (ensure it doesn't start with /)
	configPath := strings.TrimPrefix(u.config.Path, "/")
	if configPath != "" && !strings.HasSuffix(configPath, "/") {
		configPath += "/"
	}

	for _, item := range treeResp.Tree {
		// Only process files (not directories or submodules)
		if item.Type != "blob" {
			continue
		}

		// Check if file is within the configured path
		if configPath != "" && !strings.HasPrefix(item.Path, configPath) {
			continue
		}

		// Check if file has image extension
		ext := strings.ToLower(path.Ext(item.Path))
		if !imageExtensions[ext] {
			continue
		}

		// Generate CDN URL
		cdnURL := u.buildJsDelivrURL(item.Path)
		originalURL := u.buildGitHubRawURL(item.Path)

		// Extract filename from path
		fileName := path.Base(item.Path)

		record := UploadRecord{
			ID:          fmt.Sprintf("sync-%s", item.SHA[:8]),
			FileName:    fileName,
			OriginalURL: originalURL,
			CDNURL:      cdnURL,
			Size:        int64(item.Size),
			Path:        item.Path,
			Sha:         item.SHA,
			UploadTime:  time.Now(), // Use current time as we don't have actual upload time
		}
		records = append(records, record)
	}

	return records, nil
}

// SanitizeFileName sanitizes a file name for use in the repository
func SanitizeFileName(name string) string {
	// Replace spaces with underscores
	name = strings.ReplaceAll(name, " ", "_")
	// Remove potentially dangerous characters
	name = strings.ReplaceAll(name, "..", "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	return name
}

// DownloadFile downloads a file from GitHub repository
func (u *Uploader) DownloadFile(filePath string) ([]byte, error) {
	if err := u.validateConfig(); err != nil {
		return nil, err
	}

	// Get file content from GitHub
	apiURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s?ref=%s",
		githubAPIBaseURL,
		url.PathEscape(u.config.Owner),
		url.PathEscape(u.config.Repo),
		url.PathEscape(filePath),
		url.QueryEscape(u.getBranch()))

	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+u.config.GitHubToken)
	req.Header.Set("Accept", "application/vnd.github.raw")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return content, nil
}

// UploadToPath uploads content to a specific path in GitHub repository
func (u *Uploader) UploadToPath(filePath string, content []byte) (*UploadRecord, error) {
	if err := u.validateConfig(); err != nil {
		return nil, err
	}

	// Upload to GitHub
	githubResp, err := u.uploadToGitHub(filePath, content)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to GitHub: %w", err)
	}

	// Build URLs
	originalURL := u.buildGitHubRawURL(filePath)
	cdnURL := u.buildJsDelivrURL(filePath)

	record := &UploadRecord{
		FileName:    path.Base(filePath),
		OriginalURL: originalURL,
		CDNURL:      cdnURL,
		Size:        int64(githubResp.Content.Size),
		Path:        filePath,
		Sha:         githubResp.Content.Sha,
	}

	return record, nil
}

package update

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Service 更新服务（自定义实现）
type Service struct {
	currentVersion string
	updateURL      string
	enabled        bool
	client         *http.Client
	dataDir        string
	app            *application.App
}

// UpdateInfo 更新信息（用于前端）
type UpdateInfo struct {
	Version      string `json:"version"`
	Size         int64  `json:"size"`
	PatchSize    int64  `json:"patchSize"`
	HasPatch     bool   `json:"hasPatch"`
	ReleaseDate  string `json:"releaseDate"`
	ReleaseNotes string `json:"releaseNotes"`
	Mandatory    bool   `json:"mandatory"`
	DownloadURL  string `json:"downloadUrl"`
	Checksum     string `json:"checksum"`
}

// UpdateManifest 更新清单结构
type UpdateManifest struct {
	Version      string                          `json:"version"`
	ReleaseDate  string                          `json:"releaseDate"`
	ReleaseNotes string                          `json:"releaseNotes"`
	Mandatory    bool                            `json:"mandatory"`
	Platforms    map[string]*PlatformUpdateInfo  `json:"platforms"`
}

// PlatformUpdateInfo 平台特定更新信息
type PlatformUpdateInfo struct {
	URL      string                    `json:"url"`
	Size     int64                     `json:"size"`
	Checksum string                    `json:"checksum"`
	Patches  map[string]*PatchInfo     `json:"patches,omitempty"`
}

// PatchInfo 补丁信息
type PatchInfo struct {
	URL      string `json:"url"`
	Size     int64  `json:"size"`
	Checksum string `json:"checksum"`
}

// ServiceConfig 服务配置
type ServiceConfig struct {
	CurrentVersion string
	UpdateURL      string
	DataDir        string
	Enabled        bool
}

// NewService 创建更新服务
func NewService(config *ServiceConfig, app *application.App) *Service {
	return &Service{
		currentVersion: config.CurrentVersion,
		updateURL:      config.UpdateURL,
		enabled:        config.Enabled,
		dataDir:        config.DataDir,
		app:            app,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CheckForUpdate 检查更新（前端调用）
func (s *Service) CheckForUpdate() (*UpdateInfo, error) {
	if !s.enabled {
		return nil, fmt.Errorf("update service is not enabled")
	}

	log.Println("[UpdateService] Checking for updates...")

	// 获取平台标识
	platform := s.getPlatformKey()

	// 下载更新清单
	manifest, err := s.fetchManifest()
	if err != nil {
		log.Printf("[UpdateService] Failed to fetch manifest: %v", err)
		return nil, err
	}

	// 检查版本
	if manifest.Version == s.currentVersion {
		log.Println("[UpdateService] Already up to date")
		return nil, nil
	}

	// 获取平台特定信息
	platformInfo, exists := manifest.Platforms[platform]
	if !exists {
		return nil, fmt.Errorf("no update available for platform: %s", platform)
	}

	// 构建更新信息
	info := &UpdateInfo{
		Version:      manifest.Version,
		Size:         platformInfo.Size,
		ReleaseDate:  manifest.ReleaseDate,
		ReleaseNotes: manifest.ReleaseNotes,
		Mandatory:    manifest.Mandatory,
		DownloadURL:  platformInfo.URL,
		Checksum:     platformInfo.Checksum,
	}

	// 检查是否有补丁
	if patch, exists := platformInfo.Patches[s.currentVersion]; exists {
		info.HasPatch = true
		info.PatchSize = patch.Size
		info.DownloadURL = patch.URL
		info.Checksum = patch.Checksum
	}

	log.Printf("[UpdateService] Update available: %s (size: %d bytes)", info.Version, info.Size)

	return info, nil
}

// DownloadUpdate 下载更新（前端调用）
func (s *Service) DownloadUpdate(url string, expectedChecksum string) (string, error) {
	if !s.enabled {
		return "", fmt.Errorf("update service is not enabled")
	}

	log.Printf("[UpdateService] Downloading update from: %s", url)

	// 创建下载目录
	downloadDir := filepath.Join(s.dataDir, "updates")
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create download directory: %w", err)
	}

	// 下载文件
	resp, err := s.client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// 获取文件总大小
	totalSize := resp.ContentLength
	if totalSize <= 0 {
		log.Printf("[UpdateService] Warning: Content-Length is %d, progress tracking may be inaccurate", totalSize)
	}

	// 创建临时文件
	tmpFile := filepath.Join(downloadDir, "update-download.tmp")
	out, err := os.Create(tmpFile)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer out.Close()

	// 计算校验和
	hash := sha256.New()

	// 创建进度写入器
	progressWriter := &progressWriter{
		writer:    out,
		hash:      hash,
		total:     totalSize,
		app:       s.app,
		lastEmit:  time.Now(),
	}

	// 复制数据
	written, err := io.Copy(progressWriter, resp.Body)
	if err != nil {
		os.Remove(tmpFile)
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// 发送最终进度（100%）
	if s.app != nil && totalSize > 0 {
		s.app.Event.Emit("update:progress", 100)
	}

	// 验证校验和
	actualChecksum := hex.EncodeToString(hash.Sum(nil))
	if expectedChecksum != "" && !s.verifyChecksum(actualChecksum, expectedChecksum) {
		os.Remove(tmpFile)
		return "", fmt.Errorf("checksum verification failed: expected=%s, got=%s", expectedChecksum, actualChecksum)
	}

	log.Printf("[UpdateService] Download completed: %d bytes, checksum: %s", written, actualChecksum)

	return tmpFile, nil
}

// InstallUpdate 安装更新（前端调用）
// 注意：实际安装逻辑需要根据平台实现
func (s *Service) InstallUpdate(filePath string) error {
	if !s.enabled {
		return fmt.Errorf("update service is not enabled")
	}

	log.Printf("[UpdateService] Installing update from: %s", filePath)

	// 验证文件存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("update file not found: %s", filePath)
	}

	// 平台特定的安装逻辑
	switch runtime.GOOS {
	case "darwin":
		return s.installMacOS(filePath)
	case "windows":
		return s.installWindows(filePath)
	case "linux":
		return s.installLinux(filePath)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// installMacOS macOS 安装逻辑
func (s *Service) installMacOS(filePath string) error {
	log.Println("[UpdateService] Starting macOS installation...")

	// 1. 验证文件是 tar.gz
	if !strings.HasSuffix(filePath, ".tar.gz") {
		return fmt.Errorf("unsupported file format: expected .tar.gz, got %s", filePath)
	}

	// 2. 获取当前应用路径
	currentAppPath, err := s.getCurrentAppPath()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	log.Printf("[UpdateService] Current app path: %s", currentAppPath)

	// 3. 解压到临时目录
	tmpDir := filepath.Join(os.TempDir(), "ltools-update")
	if err := os.RemoveAll(tmpDir); err != nil {
		log.Printf("[UpdateService] Warning: failed to clean temp dir: %v", err)
	}
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir) // 清理临时文件

	// 4. 解压 tar.gz
	cmd := exec.Command("tar", "xzf", filePath, "-C", tmpDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to extract archive: %w\nOutput: %s", err, string(output))
	}

	// 5. 查找解压后的 .app
	var appPath string
	err = filepath.Walk(tmpDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if strings.HasSuffix(path, ".app") && info.IsDir() {
			appPath = path
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil || appPath == "" {
		return fmt.Errorf("failed to find .app bundle in extracted files")
	}

	log.Printf("[UpdateService] Extracted app: %s", appPath)

	// 6. 备份旧版本（以防万一）
	backupPath := currentAppPath + ".backup"
	if err := os.Rename(currentAppPath, backupPath); err != nil {
		log.Printf("[UpdateService] Warning: failed to backup old app: %v", err)
		// 如果备份失败，继续尝试替换
	}

	// 7. 替换应用
	if err := os.Rename(appPath, currentAppPath); err != nil {
		// 恢复备份
		if _, backupErr := os.Stat(backupPath); backupErr == nil {
			os.Rename(backupPath, currentAppPath)
		}
		return fmt.Errorf("failed to replace app: %w", err)
	}

	// 8. 删除备份
	os.Remove(backupPath)

	log.Println("[UpdateService] macOS installation completed successfully")

	// 9. 提示重启
	return s.promptRestart()
}

// installWindows Windows 安装逻辑
func (s *Service) installWindows(filePath string) error {
	log.Println("[UpdateService] Starting Windows installation...")

	// 1. 验证文件是 .exe
	if !strings.HasSuffix(filePath, ".exe") {
		return fmt.Errorf("unsupported file format: expected .exe, got %s", filePath)
	}

	// 2. 获取当前安装目录
	currentDir, err := s.getCurrentInstallDir()
	if err != nil {
		return fmt.Errorf("failed to get current install directory: %w", err)
	}

	log.Printf("[UpdateService] Current install directory: %s", currentDir)

	// 3. 运行 NSIS 静默安装
	// NSIS 参数: /S (静默) /D=目录 (安装目录，必须是最后一个参数)
	cmd := exec.Command(filePath, "/S", "/D="+currentDir)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	log.Printf("[UpdateService] Running silent installer: %s /S /D=%s", filePath, currentDir)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start installer: %w", err)
	}

	// 4. 等待安装完成
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("installer failed: %w", err)
	}

	log.Println("[UpdateService] Windows installation completed successfully")

	// 5. 提示重启
	return s.promptRestart()
}

// installLinux Linux 安装逻辑
func (s *Service) installLinux(filePath string) error {
	log.Println("[UpdateService] Starting Linux installation...")

	// 1. 判断文件类型
	if strings.HasSuffix(filePath, ".AppImage") {
		return s.installLinuxAppImage(filePath)
	} else if strings.HasSuffix(filePath, ".deb") || strings.HasSuffix(filePath, ".rpm") {
		return fmt.Errorf("DEB/RPM packages require manual installation with sudo. Please run: sudo dpkg -i %s or sudo rpm -U %s", filePath, filePath)
	}

	return fmt.Errorf("unsupported file format: %s", filePath)
}

// installLinuxAppImage AppImage 安装逻辑
func (s *Service) installLinuxAppImage(filePath string) error {
	log.Println("[UpdateService] Installing AppImage...")

	// 1. 获取当前 AppImage 路径
	currentPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current executable path: %w", err)
	}

	log.Printf("[UpdateService] Current executable: %s", currentPath)

	// 2. 备份旧版本
	backupPath := currentPath + ".backup"
	if err := os.Rename(currentPath, backupPath); err != nil {
		log.Printf("[UpdateService] Warning: failed to backup old version: %v", err)
	}

	// 3. 复制新版本
	if err := copyFile(filePath, currentPath); err != nil {
		// 恢复备份
		if _, backupErr := os.Stat(backupPath); backupErr == nil {
			os.Rename(backupPath, currentPath)
		}
		return fmt.Errorf("failed to replace AppImage: %w", err)
	}

	// 4. 设置可执行权限
	if err := os.Chmod(currentPath, 0755); err != nil {
		return fmt.Errorf("failed to set executable permission: %w", err)
	}

	// 5. 删除备份
	os.Remove(backupPath)

	log.Println("[UpdateService] AppImage installation completed successfully")

	// 6. 提示重启
	return s.promptRestart()
}

// getCurrentAppPath 获取当前 .app 路径（macOS）
func (s *Service) getCurrentAppPath() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", err
	}

	// macOS: /Applications/LTools.app/Contents/MacOS/LTools
	// 需要向上查找 .app 目录
	dir := filepath.Dir(execPath)
	for {
		if strings.HasSuffix(dir, ".app") {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			// 到达根目录，未找到 .app
			break
		}
		dir = parent
	}

	// 未找到 .app，可能是开发环境
	// 使用默认路径
	return "/Applications/LTools.app", nil
}

// getCurrentInstallDir 获取当前安装目录（Windows）
func (s *Service) getCurrentInstallDir() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", err
	}

	// Windows: C:\Program Files\My Company\LTools\ltools.exe
	// 返回安装目录
	return filepath.Dir(execPath), nil
}

// promptRestart 提示用户重启应用
func (s *Service) promptRestart() error {
	log.Println("[UpdateService] Prompting user to restart...")

	// 发送事件通知前端
	if s.app != nil {
		s.app.Event.Emit("update:installed", map[string]interface{}{
			"message": "Update installed successfully. Please restart the application.",
			"action":  "restart",
		})
	}

	return nil
}

// copyFile 复制文件
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// GetCurrentVersion 获取当前版本（前端调用）
func (s *Service) GetCurrentVersion() string {
	return s.currentVersion
}

// SetEnabled 设置是否启用自动更新（前端调用）
func (s *Service) SetEnabled(enabled bool) {
	s.enabled = enabled
	log.Printf("[UpdateService] Auto-update %s", map[bool]string{true: "enabled", false: "disabled"}[enabled])
}

// IsEnabled 检查是否启用（前端调用）
func (s *Service) IsEnabled() bool {
	return s.enabled
}

// fetchManifest 获取更新清单
func (s *Service) fetchManifest() (*UpdateManifest, error) {
	resp, err := s.client.Get(s.updateURL + "update.json")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifest fetch failed with status: %d", resp.StatusCode)
	}

	var manifest UpdateManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}

	return &manifest, nil
}

// getPlatformKey 获取平台标识
func (s *Service) getPlatformKey() string {
	return fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)
}

// verifyChecksum 验证校验和
func (s *Service) verifyChecksum(actual, expected string) bool {
	// 移除 "sha256:" 前缀（如果有）
	if len(expected) > 7 && expected[:7] == "sha256:" {
		expected = expected[7:]
	}
	return actual == expected
}

// Cleanup 清理临时文件
func (s *Service) Cleanup() error {
	downloadDir := filepath.Join(s.dataDir, "updates")
	if _, err := os.Stat(downloadDir); os.IsNotExist(err) {
		return nil
	}

	return os.RemoveAll(downloadDir)
}

// progressWriter 用于跟踪下载进度并发送事件
type progressWriter struct {
	writer    io.Writer
	hash      io.Writer
	total     int64
	written   int64
	app       *application.App
	lastEmit  time.Time
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	// 写入文件和哈希
	n, err := pw.writer.Write(p)
	if err != nil {
		return n, err
	}

	_, err = pw.hash.Write(p[:n])
	if err != nil {
		return n, err
	}

	// 更新已写入字节数
	pw.written += int64(n)

	// 每 200ms 发送一次进度事件（避免过于频繁）
	if pw.app != nil && pw.total > 0 && time.Since(pw.lastEmit) > 200*time.Millisecond {
		percentage := int(float64(pw.written) / float64(pw.total) * 100)
		if percentage > 100 {
			percentage = 100
		}
		pw.app.Event.Emit("update:progress", percentage)
		pw.lastEmit = time.Now()
	}

	return n, nil
}

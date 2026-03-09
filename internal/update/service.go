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
			Timeout: 10 * time.Minute, // 10 分钟超时，适用于大文件下载
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
	log.Printf("[UpdateService] Detected platform: %s (GOOS=%s, GOARCH=%s)", platform, runtime.GOOS, runtime.GOARCH)

	// 下载更新清单
	manifest, err := s.fetchManifest()
	if err != nil {
		log.Printf("[UpdateService] Failed to fetch manifest: %v", err)
		return nil, err
	}

	// 检查版本（使用语义化版本比较）
	cmp := compareVersions(manifest.Version, s.currentVersion)
	if cmp <= 0 {
		// 远程版本 <= 当前版本，已是最新版本
		log.Printf("[UpdateService] Already up to date (current: %s, remote: %s)", s.currentVersion, manifest.Version)
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

	// 发送事件通知前端（保持与启动时自动检查的行为一致）
	if s.app != nil {
		s.app.Event.Emit("update:available", info)
	}

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
		// 校验和验证失败
		// 保留损坏的文件供调试（添加 .corrupted 后缀）
		corruptedFile := tmpFile + ".corrupted"
		if err := os.Rename(tmpFile, corruptedFile); err != nil {
			log.Printf("[UpdateService] Warning: failed to rename corrupted file: %v", err)
			os.Remove(tmpFile)
		} else {
			log.Printf("[UpdateService] Corrupted file saved for debugging: %s", corruptedFile)
		}

		// 返回友好的错误信息
		return "", fmt.Errorf("checksum verification failed: expected=%s, got=%s. The download may be corrupted. Please try again", expectedChecksum, actualChecksum)
	}

	log.Printf("[UpdateService] Download completed: %d bytes, checksum: %s", written, actualChecksum)

	// 确定文件扩展名（从 URL 提取）
	var ext string
	// 特殊处理 .tar.gz 双扩展名
	if strings.HasSuffix(url, ".tar.gz") {
		ext = ".tar.gz"
	} else if strings.HasSuffix(url, ".tar.bz2") {
		ext = ".tar.bz2"
	} else {
		ext = filepath.Ext(url)
	}

	if ext == "" || ext == "." {
		// 如果 URL 没有扩展名，根据平台使用默认扩展名
		switch runtime.GOOS {
		case "darwin":
			ext = ".tar.gz"
		case "windows":
			ext = ".exe"
		case "linux":
			ext = ".AppImage"
		default:
			ext = ".tar.gz"
		}
	}

	// 重命名临时文件为最终文件名
	finalFile := filepath.Join(downloadDir, "update"+ext)
	if err := os.Rename(tmpFile, finalFile); err != nil {
		log.Printf("[UpdateService] Warning: failed to rename file, using temp path: %v", err)
		// 如果重命名失败，返回临时文件路径
		return tmpFile, nil
	}

	log.Printf("[UpdateService] File renamed to: %s", finalFile)
	return finalFile, nil
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
	backupSuccess := true
	if err := os.Rename(currentAppPath, backupPath); err != nil {
		log.Printf("[UpdateService] Warning: failed to backup old app: %v", err)
		backupSuccess = false

		// 如果备份失败（可能文件正在使用），尝试直接删除
		log.Printf("[UpdateService] Attempting to remove old app directly...")
		if err := os.RemoveAll(currentAppPath); err != nil {
			return fmt.Errorf("failed to backup or remove old app: %w", err)
		}
	}

	// 7. 替换应用
	if err := os.Rename(appPath, currentAppPath); err != nil {
		// 如果替换失败，尝试恢复备份
		if backupSuccess {
			if _, backupErr := os.Stat(backupPath); backupErr == nil {
				log.Printf("[UpdateService] Attempting to restore backup...")
				os.Rename(backupPath, currentAppPath)
			}
		}
		return fmt.Errorf("failed to replace app: %w", err)
	}

	// 8. 删除备份（如果存在）
	if backupSuccess {
		if err := os.Remove(backupPath); err != nil {
			log.Printf("[UpdateService] Warning: failed to remove backup: %v", err)
		}
	}

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

	log.Printf("[UpdateService] Running silent installer: %s /S /D=%s", filePath, currentDir)

	// 4. 启动安装程序（不等待完成）
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start installer: %w", err)
	}

	// 5. 给安装程序 2 秒启动时间
	time.Sleep(2 * time.Second)

	log.Println("[UpdateService] Installer started, exiting current application...")

	// 6. 退出当前应用，让安装程序完成
	// 安装程序会自动覆盖文件并重启应用
	os.Exit(0)

	return nil
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
	if err := os.Remove(backupPath); err != nil {
		log.Printf("[UpdateService] Warning: failed to remove backup: %v", err)
	}

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

// RestartApp 重启应用（前端调用）
func (s *Service) RestartApp() error {
	log.Println("[UpdateService] Restarting application...")

	// 获取当前可执行文件路径
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	log.Printf("[UpdateService] Current executable: %s", execPath)

	// 平台特定的重启逻辑
	switch runtime.GOOS {
	case "windows":
		return s.restartWindows(execPath)
	case "darwin":
		return s.restartMacOS(execPath)
	case "linux":
		return s.restartLinux(execPath)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// restartMacOS macOS 重启逻辑
func (s *Service) restartMacOS(execPath string) error {
	log.Println("[UpdateService] Restarting on macOS...")

	// 如果是 .app bundle，需要启动整个 .app
	if strings.Contains(execPath, ".app/Contents/MacOS/") {
		// 查找 .app 根目录
		appPath := execPath
		for !strings.HasSuffix(appPath, ".app") {
			appPath = filepath.Dir(appPath)
			if appPath == "/" {
				return fmt.Errorf("failed to find .app bundle")
			}
		}

		log.Printf("[UpdateService] Restarting .app bundle: %s", appPath)

		// 使用 open 命令启动 .app
		cmd := exec.Command("open", appPath)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to start .app: %w", err)
		}
	} else {
		// 开发环境或独立二进制
		cmd := exec.Command(execPath)
		cmd.Env = os.Environ()
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to start executable: %w", err)
		}
	}

	log.Println("[UpdateService] New instance started, exiting current...")

	// 退出当前应用
	os.Exit(0)

	return nil
}

// restartLinux Linux 重启逻辑
func (s *Service) restartLinux(execPath string) error {
	log.Println("[UpdateService] Restarting on Linux...")

	// 启动新实例
	cmd := exec.Command(execPath)
	cmd.Env = os.Environ()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start new instance: %w", err)
	}

	log.Println("[UpdateService] New instance started, exiting current...")

	// 退出当前应用
	os.Exit(0)

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

// compareVersions 比较两个语义化版本号
// 返回值: 1 (v1 > v2), 0 (v1 == v2), -1 (v1 < v2)
func compareVersions(v1, v2 string) int {
	// 移除可能的 'v' 前缀
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	// 分割版本号
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	// 确保至少有 3 个部分 (major.minor.patch)
	for len(parts1) < 3 {
		parts1 = append(parts1, "0")
	}
	for len(parts2) < 3 {
		parts2 = append(parts2, "0")
	}

	// 比较每个部分
	for i := 0; i < 3; i++ {
		num1, err1 := parseVersionPart(parts1[i])
		num2, err2 := parseVersionPart(parts2[i])

		// 如果解析失败，按字符串比较
		if err1 != nil || err2 != nil {
			if parts1[i] > parts2[i] {
				return 1
			} else if parts1[i] < parts2[i] {
				return -1
			}
			continue
		}

		if num1 > num2 {
			return 1
		} else if num1 < num2 {
			return -1
		}
	}

	return 0
}

// parseVersionPart 解析版本号的某个部分
func parseVersionPart(part string) (int, error) {
	// 移除可能的后缀（如 "-beta", "-rc1"）
	if idx := strings.Index(part, "-"); idx != -1 {
		part = part[:idx]
	}
	if idx := strings.Index(part, "+"); idx != -1 {
		part = part[:idx]
	}

	var num int
	_, err := fmt.Sscanf(part, "%d", &num)
	return num, err
}

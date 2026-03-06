package tunnel

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	frpLatestVersion = "v0.52.0"
)

// FRPInstaller FRP 安装器
type FRPInstaller struct {
	installPath string
}

// NewFRPInstaller 创建 FRP 安装器
func NewFRPInstaller() *FRPInstaller {
	return &FRPInstaller{}
}

// CheckInstallation 检查 FRP 是否已安装
func (i *FRPInstaller) CheckInstallation() (string, error) {
	execName := "frpc"
	if runtime.GOOS == "windows" {
		execName = "frpc.exe"
	}

	// 1. 尝试从当前环境的 PATH 查找
	if path, err := exec.LookPath(execName); err == nil {
		version, _ := i.getVersion(path)
		return version + " (" + path + ")", nil
	}

	// 2. 检查常见安装路径（不依赖 shell，直接检查文件系统）
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = os.Getenv("HOME")
	}
	if homeDir == "" {
		homeDir = "/Users/" + os.Getenv("USER")
	}

	var commonPaths []string
	switch runtime.GOOS {
	case "darwin":
		commonPaths = []string{
			filepath.Join(homeDir, "bin", "frpc"),
			"/opt/homebrew/bin/frpc",
			"/usr/local/bin/frpc",
			"/usr/bin/frpc",
			filepath.Join(homeDir, ".local", "bin", "frpc"),
			filepath.Join(homeDir, ".frp", "frpc"),
		}
	case "windows":
		appData := os.Getenv("APPDATA")
		localAppData := os.Getenv("LOCALAPPDATA")
		programFiles := os.Getenv("ProgramFiles")

		commonPaths = []string{
			filepath.Join(homeDir, "bin", "frpc.exe"),
			filepath.Join(programFiles, "frp", "frpc.exe"),
			filepath.Join(appData, "frp", "frpc.exe"),
			filepath.Join(localAppData, "frp", "frpc.exe"),
			"C:\\ProgramData\\chocolatey\\bin\\frpc.exe",
		}
	default: // Linux
		commonPaths = []string{
			filepath.Join(homeDir, "bin", "frpc"),
			filepath.Join(homeDir, ".local", "bin", "frpc"),
			"/usr/bin/frpc",
			"/usr/local/bin/frpc",
			filepath.Join(homeDir, ".frp", "frpc"),
			"/snap/bin/frpc",
		}
	}

	for _, path := range commonPaths {
		if path == "" {
			continue
		}
		if _, err := os.Stat(path); err == nil {
			version, _ := i.getVersion(path)
			return version + " (" + path + ")", nil
		}
	}

	return "", fmt.Errorf("FRP not installed")
}

// getVersion 获取 FRP 版本
func (i *FRPInstaller) getVersion(path string) (string, error) {
	cmd := exec.Command(path, "--version")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}

// Install 安装 FRP
func (i *FRPInstaller) Install(onProgress func(string)) error {
	switch runtime.GOOS {
	case "darwin", "linux":
		return i.installUnix(onProgress)
	case "windows":
		return i.installWindows(onProgress)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// installUnix 在 Unix 系统上安装 FRP
func (i *FRPInstaller) installUnix(onProgress func(message string)) error {
	onProgress("正在下载 FRP...")

	// 确定架构
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	var assetName string
	switch goos {
	case "darwin":
		if goarch == "arm64" {
			assetName = "frp_" + frpLatestVersion + "_darwin_arm64.tar.gz"
		} else {
			assetName = "frp_" + frpLatestVersion + "_darwin_amd64.tar.gz"
		}
	case "linux":
		assetName = "frp_" + frpLatestVersion + "_linux_amd64.tar.gz"
	default:
		return fmt.Errorf("unsupported platform for direct download: %s", goos)
	}

	// 下载 URL
	downloadURL := fmt.Sprintf(
		"https://github.com/fatedier/frp/releases/download/%s/%s",
		frpLatestVersion,
		assetName,
	)

	// 下载到临时文件
	tempDir := os.TempDir()
	archivePath := filepath.Join(tempDir, "frp.tar.gz")

	onProgress("正在下载...")
	downloadCmd := exec.Command("curl", "-L", "-o", archivePath, downloadURL)
	if output, err := downloadCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("下载失败: %w\nOutput: %s", err, string(output))
	}

	// 解压到临时目录
	onProgress("正在解压...")
	tempExtractDir := filepath.Join(tempDir, "frp_extract")
	os.MkdirAll(tempExtractDir, 0755)
	extractCmd := exec.Command("tar", "-xzf", archivePath, "-C", tempExtractDir)
	if output, err := extractCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("解压失败: %w\nOutput: %s", err, string(output))
	}

	// 安装到 /usr/local/bin
	installDir := "/usr/local/bin"
	frpcSource := filepath.Join(tempExtractDir, "frpc")
	
	onProgress("正在安装...")
	// 使用 cp 命令复制
	cpCmd := exec.Command("cp", frpcSource, filepath.Join(installDir, "frpc"))
	if output, err := cpCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("安装失败: %w\nOutput: %s", err, string(output))
	}

	// 设置权限
	onProgress("设置权限...")
	frpcPath := filepath.Join(installDir, "frpc")
	if err := os.Chmod(frpcPath, 0755); err != nil {
		return fmt.Errorf("设置权限失败: %w", err)
	}

	// 清理临时文件
	os.Remove(archivePath)
	os.RemoveAll(tempExtractDir)

	onProgress(fmt.Sprintf("FRP 已安装到: %s", frpcPath))
	i.installPath = frpcPath

	return nil
}

// installWindows 在 Windows 上安装
func (i *FRPInstaller) installWindows(onProgress func(message string)) error {
	onProgress("Windows 平台 FRP 安装需要手动操作")
	onProgress("请访问 https://github.com/fatedier/frp/releases 下载")
	return fmt.Errorf("automatic installation on Windows not yet supported")
}

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

	// 2. 尝试使用 login shell 查找（继承用户的 PATH 配置）
	// 这样可以找到用户在 ~/.bashrc 或 ~/.zshrc 中配置的 ~/bin 等目录
	var shellCmd *exec.Cmd
	if runtime.GOOS == "windows" {
		// Windows: 使用 cmd.exe 的 where 命令
		shellCmd = exec.Command("cmd.exe", "/c", "where", execName)
	} else {
		// Unix/macOS: 使用登录 shell 执行 which 命令
		// -l: 登录 shell，加载 ~/.bash_profile / ~/.zprofile
		shellCmd = exec.Command("/bin/bash", "-l", "-c", "which "+execName)
	}

	if output, err := shellCmd.Output(); err == nil {
		// which/where 命令可能返回多行，取第一个
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		if len(lines) > 0 && lines[0] != "" {
			foundPath := strings.TrimSpace(lines[0])
			// 验证文件存在
			if _, err := os.Stat(foundPath); err == nil {
				version, _ := i.getVersion(foundPath)
				return version + " (" + foundPath + ")", nil
			}
		}
	}

	// 3. 检查常见安装路径
	homeDir := os.Getenv("HOME")
	commonPaths := []string{
		filepath.Join(homeDir, ".local", "bin", "frpc"),
		"/usr/local/bin/frpc",
		"/usr/bin/frpc",
		filepath.Join(homeDir, ".frp", "frpc"),
	}

	for _, path := range commonPaths {
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

package musicplayer

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// ProcessManager Node.js 进程管理器
type ProcessManager struct {
	cmd          *exec.Cmd
	stdin        io.WriteCloser
	stdout       io.Reader
	stderr       io.Reader
	processMutex sync.RWMutex

	// 进程状态
	isRunning bool
	startTime time.Time

	// 配置
	nodePath   string // Node.js 可执行文件路径
	serviceDir string // lx-music-service 目录路径

	// 健康检查
	healthCheckInterval time.Duration
	lastHealthCheck     time.Time
	healthCheckErrors   int
}

// ProcessManagerConfig 进程管理器配置
type ProcessManagerConfig struct {
	NodePath           string // Node.js 路径（如果为空，使用 "node"）
	ServiceDir         string // lx-music-service 目录路径
	HealthCheckInterval time.Duration
}

// NewProcessManager 创建进程管理器
func NewProcessManager(config *ProcessManagerConfig) (*ProcessManager, error) {
	// 默认配置
	if config.NodePath == "" {
		config.NodePath = "node"
	}
	if config.HealthCheckInterval == 0 {
		config.HealthCheckInterval = 30 * time.Second
	}

	// 如果未指定服务目录，使用默认路径
	if config.ServiceDir == "" {
		// 获取当前可执行文件目录
		execPath, err := os.Executable()
		if err != nil {
			return nil, fmt.Errorf("failed to get executable path: %w", err)
		}

		// 推算 lx-music-service 目录路径
		appDir := filepath.Dir(execPath)

		// 尝试多个可能的位置
		possiblePaths := []string{
			// 1. 可执行文件同目录（Windows, Linux AppImage, 开发环境）
			filepath.Join(appDir, "lx-music-service"),

			// 2. macOS .app bundle: Contents/MacOS/../Resources/
			filepath.Join(appDir, "..", "Resources", "lx-music-service"),

			// 3. Linux 系统安装: /usr/local/bin -> /usr/local/share/ltools/
			filepath.Join(appDir, "..", "share", "ltools", "lx-music-service"),

			// 4. 开发环境：项目根目录
			"lx-music-service",
		}

		// 查找第一个存在的路径
		for i, path := range possiblePaths {
			absPath, _ := filepath.Abs(path)
			log.Printf("[ProcessManager] Checking path %d: %s (absolute: %s)", i, path, absPath)
			if _, err := os.Stat(path); err == nil {
				config.ServiceDir = path
				log.Printf("[ProcessManager] Found service directory: %s", path)
				break
			}
		}

		// 如果都没找到，使用默认路径（会在后面的检查中报错）
		if config.ServiceDir == "" {
			config.ServiceDir = possiblePaths[0]
		}
	}

	// 检查服务目录是否存在
	if _, err := os.Stat(config.ServiceDir); os.IsNotExist(err) {
		return nil, fmt.Errorf(`lx-music-service directory not found: %s

This directory is required for music player functionality.

Expected locations:
  • Windows: <install-dir>/lx-music-service/
  • macOS: LTools.app/Contents/Resources/lx-music-service/
  • Linux (DEB/RPM): /usr/local/share/ltools/lx-music-service/
  • Linux (AppImage): <appimage>/lx-music-service/
  • Development: ./lx-music-service/

If you're a user:
  Please ensure the application was installed correctly with all bundled files.

If you're a developer:
  Run 'wails3 package' to create a properly bundled application.`, config.ServiceDir)
	}

	log.Printf("[ProcessManager] Using service directory: %s", config.ServiceDir)

	// 检查 Node.js 是否安装
	if err := checkNodeInstalled(config.NodePath); err != nil {
		return nil, fmt.Errorf(`Node.js check failed: %w

The music player plugin requires Node.js to run the music source service.

Please install Node.js:
  • Download from: https://nodejs.org/
  • Recommended: LTS version (Long Term Support)
  • Minimum required: Node.js 16.0.0 or later

After installation, restart the application.`, err)
	}

	return &ProcessManager{
		nodePath:            config.NodePath,
		serviceDir:          config.ServiceDir,
		healthCheckInterval: config.HealthCheckInterval,
	}, nil
}

// Start 启动进程
func (pm *ProcessManager) Start() error {
	pm.processMutex.Lock()
	defer pm.processMutex.Unlock()

	if pm.isRunning {
		return fmt.Errorf("process is already running")
	}

	// 构建启动命令
	// 注意：如果设置了 cmd.Dir，则 serverPath 应该是相对于该目录的相对路径
	serverPath := "server.js" // 相对于 pm.serviceDir
	absServiceDir, _ := filepath.Abs(pm.serviceDir)
	log.Printf("[ProcessManager] Server path: %s (relative to working dir)", serverPath)
	log.Printf("[ProcessManager] Working directory: %s (absolute: %s)", pm.serviceDir, absServiceDir)
	pm.cmd = exec.Command(pm.nodePath, serverPath)
	pm.cmd.Dir = pm.serviceDir

	// 获取 stdin/stdout/stdout 管道
	stdin, err := pm.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	pm.stdin = stdin

	stdout, err := pm.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	pm.stdout = stdout

	stderr, err := pm.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	pm.stderr = stderr

	// 启动进程
	if err := pm.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start process: %w", err)
	}

	pm.isRunning = true
	pm.startTime = time.Now()

	// 启动 goroutine 读取 stderr（日志）
	go pm.readStderr()

	log.Printf("[ProcessManager] Process started (PID: %d)", pm.cmd.Process.Pid)

	// 等待一小段时间，确保服务器初始化完成
	time.Sleep(500 * time.Millisecond)

	return nil
}

// Stop 停止进程
func (pm *ProcessManager) Stop() error {
	pm.processMutex.Lock()
	defer pm.processMutex.Unlock()

	if !pm.isRunning {
		return nil
	}

	// 关闭 stdin
	if pm.stdin != nil {
		pm.stdin.Close()
	}

	// 发送 SIGTERM 信号
	if pm.cmd != nil && pm.cmd.Process != nil {
		if err := pm.cmd.Process.Signal(os.Interrupt); err != nil {
			log.Printf("[ProcessManager] Failed to send SIGTERM: %v", err)
		}

		// 等待进程退出（最多 5 秒）
		done := make(chan error, 1)
		go func() {
			done <- pm.cmd.Wait()
		}()

		select {
		case <-time.After(5 * time.Second):
			// 强制杀死进程
			log.Printf("[ProcessManager] Force killing process")
			pm.cmd.Process.Kill()
		case err := <-done:
			if err != nil {
				log.Printf("[ProcessManager] Process exited with error: %v", err)
			}
		}
	}

	pm.isRunning = false
	log.Printf("[ProcessManager] Process stopped")

	return nil
}

// Restart 重启进程
func (pm *ProcessManager) Restart() error {
	if err := pm.Stop(); err != nil {
		log.Printf("[ProcessManager] Failed to stop process during restart: %v", err)
	}

	time.Sleep(1 * time.Second)

	return pm.Start()
}

// IsRunning 检查进程是否运行中
func (pm *ProcessManager) IsRunning() bool {
	pm.processMutex.RLock()
	defer pm.processMutex.RUnlock()
	return pm.isRunning
}

// GetStdin 获取 stdin 管道
func (pm *ProcessManager) GetStdin() io.WriteCloser {
	pm.processMutex.RLock()
	defer pm.processMutex.RUnlock()
	return pm.stdin
}

// GetStdout 获取 stdout 管道
func (pm *ProcessManager) GetStdout() io.Reader {
	pm.processMutex.RLock()
	defer pm.processMutex.RUnlock()
	return pm.stdout
}

// readStderr 读取 stderr（日志输出）
func (pm *ProcessManager) readStderr() {
	scanner := bufio.NewScanner(pm.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("[LXService] %s", line)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[ProcessManager] Error reading stderr: %v", err)
	}
}

// WaitForExit 等待进程退出
func (pm *ProcessManager) WaitForExit() error {
	if pm.cmd == nil {
		return fmt.Errorf("process not started")
	}

	return pm.cmd.Wait()
}

// GetUptime 获取进程运行时长
func (pm *ProcessManager) GetUptime() time.Duration {
	pm.processMutex.RLock()
	defer pm.processMutex.RUnlock()

	if !pm.isRunning {
		return 0
	}

	return time.Since(pm.startTime)
}

// checkNodeInstalled 检查 Node.js 是否安装
func checkNodeInstalled(nodePath string) error {
	cmd := exec.Command(nodePath, "--version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("node.js not found at '%s': %w", nodePath, err)
	}

	version := string(output)
	log.Printf("[ProcessManager] Node.js version: %s", version)

	// 解析版本号，检查是否 >= 16.0.0
	var major, minor, patch int
	if _, err := fmt.Sscanf(version, "v%d.%d.%d", &major, &minor, &patch); err != nil {
		log.Printf("[ProcessManager] Warning: Could not parse Node.js version: %s", version)
		return nil // 如果无法解析，继续执行
	}

	if major < 16 {
		return fmt.Errorf("Node.js version %d.%d.%d is too old. Please upgrade to Node.js >= 16.0.0 (recommended: LTS version from https://nodejs.org)", major, minor, patch)
	}

	log.Printf("[ProcessManager] Node.js version check passed: v%d.%d.%d", major, minor, patch)
	return nil
}

// HealthCheckWithContext 健康检查（带超时）
func (pm *ProcessManager) HealthCheckWithContext(ctx context.Context) error {
	// 这里只是简单检查进程是否运行
	// 实际的健康检查由 LXClient 实现
	if !pm.IsRunning() {
		return fmt.Errorf("process is not running")
	}

	return nil
}

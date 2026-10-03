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
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"ltools/internal/processutil"
)

// ProcessManager Node.js 进程管理器
type ProcessManager struct {
	cmd          *exec.Cmd
	stdin        io.WriteCloser
	stdout       io.Reader
	stderr       io.Reader
	processMutex sync.RWMutex
	exited       chan struct{}
	exitError    error

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
	NodePath            string // Node.js 路径（如果为空，使用 "node"）
	ServiceDir          string // lx-music-service 目录路径
	HealthCheckInterval time.Duration
}

// NewProcessManager 创建进程管理器
func NewProcessManager(config *ProcessManagerConfig) (*ProcessManager, error) {
	// 默认配置
	if config.HealthCheckInterval == 0 {
		config.HealthCheckInterval = 30 * time.Second
	}

	// 智能查找 Node.js 可执行文件
	var actualNodePath string
	var err error

	if config.NodePath != "" && config.NodePath != "node" {
		// 用户指定了特定路径，直接使用
		actualNodePath = config.NodePath
		log.Printf("[ProcessManager] Using user-specified Node.js path: %s", actualNodePath)
	} else {
		// 自动查找 Node.js
		actualNodePath, err = findNodeExecutable()
		if err != nil {
			return nil, fmt.Errorf(`failed to find Node.js: %w

The music player plugin requires Node.js to run the music source service.

Please install Node.js:
  • Download from: https://nodejs.org/
  • Recommended: LTS version (Long Term Support)
  • Minimum required: Node.js 16.0.0 or later

After installation, restart the application.`, err)
		}
	}

	// 检查 Node.js 版本
	if err := checkNodeInstalled(actualNodePath); err != nil {
		return nil, err
	}

	// 更新配置
	config.NodePath = actualNodePath

	log.Printf("[ProcessManager] Node.js executable: %s", actualNodePath)

	// 如果未指定服务目录，使用默认路径
	if config.ServiceDir == "" {
		// 获取当前可执行文件目录
		execPath, err := os.Executable()
		if err != nil {
			return nil, fmt.Errorf("failed to get executable path: %w", err)
		}

		// 推算 lx-music-service 目录路径
		appDir := filepath.Dir(execPath)
		cwd, _ := os.Getwd()
		log.Printf("[ProcessManager] === Path Resolution Debug ===")
		log.Printf("[ProcessManager] Executable path: %s", execPath)
		log.Printf("[ProcessManager] App directory: %s", appDir)
		log.Printf("[ProcessManager] Current working directory: %s", cwd)

		// 尝试多个可能的位置（按优先级排序）
		possiblePaths := []struct {
			path string
			desc string
		}{
			// 1. 嵌入的 bundle 文件（打包优化版本，优先）
			{filepath.Join(appDir, "..", "Resources", "lx-music-service", "dist"), "macOS .app bundle (bundle mode)"},

			// 2. macOS .app bundle: Contents/MacOS/../Resources/ (完整版本)
			{filepath.Join(appDir, "..", "Resources", "lx-music-service"), "macOS .app bundle (full)"},

			// 3. 可执行文件同目录的 bundle（打包优化版本）
			{filepath.Join(appDir, "lx-music-service", "dist"), "Same directory as executable (bundle mode)"},

			// 4. 可执行文件同目录（完整版本）
			{filepath.Join(appDir, "lx-music-service"), "Same directory as executable"},

			// 5. Linux 系统安装: /usr/local/bin -> /usr/local/share/ltools/
			{filepath.Join(appDir, "..", "share", "ltools", "lx-music-service"), "Linux system install (/usr/local/share/)"},

			// 6. 开发环境：项目根目录 bundle 模式
			{filepath.Join(cwd, "lx-music-service", "dist"), "Development (CWD/lx-music-service/dist)"},

			// 7. 开发环境：项目根目录（基于 CWD）
			{filepath.Join(cwd, "lx-music-service"), "Development (CWD/lx-music-service)"},

			// 8. 测试打包后的裸二进制：bin/ -> ../lx-music-service（项目根目录）
			{filepath.Join(appDir, "..", "lx-music-service"), "Test binary (project root, bin/../lx-music-service)"},

			// 9. 开发环境：相对路径（后备）
			{"lx-music-service", "Relative path (fallback)"},
		}

		// 查找第一个存在的路径
		for i, item := range possiblePaths {
			absPath, _ := filepath.Abs(item.path)
			log.Printf("[ProcessManager] Checking path %d: %s", i, item.path)
			log.Printf("[ProcessManager]   → Description: %s", item.desc)
			log.Printf("[ProcessManager]   → Absolute: %s", absPath)

			if _, err := os.Stat(item.path); err == nil {
				config.ServiceDir = item.path
				log.Printf("[ProcessManager] ✅ Found service directory: %s", absPath)
				break
			} else {
				log.Printf("[ProcessManager] ❌ Path not found: %s", absPath)
			}
		}

		// 如果都没找到，使用默认路径（会在后面的检查中报错）
		if config.ServiceDir == "" {
			config.ServiceDir = possiblePaths[0].path
		}
	}

	// 检查服务目录是否存在
	if _, err := os.Stat(config.ServiceDir); os.IsNotExist(err) {
		// 尝试提取嵌入的服务目录
		log.Printf("[ProcessManager] Local service directory not found, trying to extract embedded version...")
		extractedDir, extractErr := extractEmbeddedService()
		if extractErr == nil {
			config.ServiceDir = extractedDir
			log.Printf("[ProcessManager] Using extracted service directory: %s", extractedDir)
		} else {
			// 提供更详细的错误信息
			execPath, _ := os.Executable()
			cwd, _ := os.Getwd()
			errorMsg := fmt.Sprintf(`lx-music-service directory not found: %s

Debug Information:
  • Executable path: %s
  • Working directory (CWD): %s
  • App directory: %s
  • Extraction error: %v

This directory is required for music player functionality.

Expected locations (checked in order):
  1. %s (same directory as executable)
  2. %s (macOS .app bundle: Contents/Resources/)
  3. %s (Linux system install: /usr/local/share/ltools/)
  4. %s (development: relative to CWD)

If you're a user:
  Please ensure the application was installed correctly with all bundled files.

If you're a developer:
  • For production build: Run 'wails3 package' to create a properly bundled application
  • For development: Run from project root directory or set ServiceDir explicitly`,
				config.ServiceDir,
				execPath,
				cwd,
				filepath.Dir(execPath),
				extractErr,
				filepath.Join(filepath.Dir(execPath), "lx-music-service"),
				filepath.Join(filepath.Dir(execPath), "..", "Resources", "lx-music-service"),
				filepath.Join(filepath.Dir(execPath), "..", "share", "ltools", "lx-music-service"),
				"lx-music-service (relative to CWD)")

			return nil, fmt.Errorf("%s", errorMsg)
		}
	}

	log.Printf("[ProcessManager] Using service directory: %s", config.ServiceDir)

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
	// 检查是否存在 bundle 文件（打包优化模式）
	absServiceDir, _ := filepath.Abs(pm.serviceDir)
	bundlePath := filepath.Join(pm.serviceDir, "server.bundle.js")
	serverPath := "server.js" // 默认使用完整模式

	if _, err := os.Stat(bundlePath); err == nil {
		// Bundle 模式：使用打包后的单文件
		serverPath = "server.bundle.js"
		log.Printf("[ProcessManager] Using bundle mode: server.bundle.js")
	} else {
		// 完整模式：使用传统的 server.js + node_modules
		serverPath = "server.js"
		log.Printf("[ProcessManager] Using full mode: server.js")
	}

	log.Printf("[ProcessManager] Server path: %s", serverPath)
	log.Printf("[ProcessManager] Working directory: %s", absServiceDir)
	pm.cmd = exec.Command(pm.nodePath, serverPath)
	processutil.Background(pm.cmd)
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
	pm.exited = make(chan struct{})
	pm.exitError = nil

	// 启动 goroutine 读取 stderr（日志）
	go pm.readStderr()
	cmd, exited := pm.cmd, pm.exited
	go func() {
		err := cmd.Wait()
		pm.processMutex.Lock()
		if pm.cmd == cmd {
			pm.isRunning = false
			pm.exitError = err
		}
		pm.processMutex.Unlock()
		close(exited)
	}()

	log.Printf("[ProcessManager] Process started (PID: %d)", pm.cmd.Process.Pid)

	// 等待一小段时间，确保服务器初始化完成
	time.Sleep(500 * time.Millisecond)

	return nil
}

// Stop 停止进程
func (pm *ProcessManager) Stop() error {
	pm.processMutex.Lock()
	if !pm.isRunning {
		pm.processMutex.Unlock()
		return nil
	}
	if pm.stdin != nil {
		pm.stdin.Close()
	}
	cmd, exited := pm.cmd, pm.exited
	pm.processMutex.Unlock()
	if runtime.GOOS == "windows" {
		_ = cmd.Process.Kill()
	} else {
		_ = cmd.Process.Signal(os.Interrupt)
	}
	select {
	case <-exited:
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		<-exited
	}
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
	pm.processMutex.RLock()
	exited := pm.exited
	pm.processMutex.RUnlock()
	if exited == nil {
		return fmt.Errorf("process not started")
	}
	<-exited
	pm.processMutex.RLock()
	defer pm.processMutex.RUnlock()
	return pm.exitError
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

// findNodeExecutable 查找 Node.js 可执行文件
// 支持多种安装方式：nvm, Homebrew, 系统包, 官方安装包
func findNodeExecutable() (string, error) {
	log.Printf("[ProcessManager] Searching for Node.js executable...")
	log.Printf("[ProcessManager] PATH environment: %s", os.Getenv("PATH"))

	// 1. 先尝试 PATH 中的 "node"
	if path, err := exec.LookPath("node"); err == nil {
		log.Printf("[ProcessManager] ✅ Found Node.js in PATH: %s", path)
		return path, nil
	}
	log.Printf("[ProcessManager] Node.js not found in PATH, searching common locations...")

	// 2. 尝试常见路径
	var candidates []string

	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		candidates = []string{
			// nvm: 查找当前使用的版本（.nvm/current 符号链接）
			filepath.Join(home, ".nvm", "current", "bin", "node"),
			// Homebrew (Apple Silicon)
			"/opt/homebrew/bin/node",
			// Homebrew (Intel)
			"/usr/local/bin/node",
			// 官方安装包
			"/usr/local/bin/node",
		}

		// 尝试查找 nvm 版本目录（使用 glob 模式）
		nvmPattern := filepath.Join(home, ".nvm", "versions", "node", "*", "bin", "node")
		if matches, err := filepath.Glob(nvmPattern); err == nil && len(matches) > 0 {
			// 按版本号排序（新版本在前）
			sort.Slice(matches, func(i, j int) bool {
				// 从路径中提取版本号
				vi := extractVersionFromPath(matches[i])
				vj := extractVersionFromPath(matches[j])
				// 降序排列（新版本优先）
				return compareVersions(vi, vj) > 0
			})
			// 将匹配的路径添加到候选列表前面（优先级更高）
			candidates = append(matches, candidates...)
			log.Printf("[ProcessManager] Found %d nvm versions (sorted by version)", len(matches))
			for i, m := range matches {
				if i >= 3 {
					log.Printf("[ProcessManager]   ... and %d more", len(matches)-3)
					break
				}
				log.Printf("[ProcessManager]   Version %d: %s", i+1, m)
			}
		}

	case "windows":
		// Windows 路径
		appData := os.Getenv("APPDATA")
		programFiles := os.Getenv("PROGRAMFILES")

		candidates = []string{
			// nvm-windows
			filepath.Join(appData, "nvm", "node.exe"),
			// 官方安装 (Program Files)
			filepath.Join(programFiles, "nodejs", "node.exe"),
			// 常见安装位置
			"C:\\Program Files\\nodejs\\node.exe",
			"C:\\Program Files (x86)\\nodejs\\node.exe",
		}

	default: // Linux
		home, _ := os.UserHomeDir()
		candidates = []string{
			// nvm: 当前版本
			filepath.Join(home, ".nvm", "current", "bin", "node"),
			// nvm 环境变量
			os.Getenv("NVM_BIN"),
			// 系统包
			"/usr/bin/node",
			"/usr/local/bin/node",
		}

		// 尝试查找 nvm 版本目录
		nvmPattern := filepath.Join(home, ".nvm", "versions", "node", "*", "bin", "node")
		if matches, err := filepath.Glob(nvmPattern); err == nil && len(matches) > 0 {
			candidates = append(matches, candidates...)
			log.Printf("[ProcessManager] Found %d nvm versions", len(matches))
		}
	}

	// 3. 检查候选路径
	log.Printf("[ProcessManager] Checking %d candidate paths...", len(candidates))
	for i, candidate := range candidates {
		if candidate == "" {
			continue
		}

		// 对于通配符路径，已经通过 Glob 处理过了
		if _, err := os.Stat(candidate); err == nil {
			// 检查是否可执行
			if absPath, err := filepath.Abs(candidate); err == nil {
				log.Printf("[ProcessManager] ✅ Found Node.js at candidate #%d: %s (absolute: %s)", i, candidate, absPath)
				return absPath, nil
			}
		} else {
			log.Printf("[ProcessManager]   Candidate #%d not found: %s", i, candidate)
		}
	}

	return "", fmt.Errorf("Node.js not found in common locations")
}

// checkNodeInstalled 检查 Node.js 是否安装
func checkNodeInstalled(nodePath string) error {
	cmd := exec.Command(nodePath, "--version")
	processutil.Background(cmd)
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

// extractVersionFromPath 从 nvm 路径中提取版本号
// 例如: /Users/name/.nvm/versions/node/v22.21.1/bin/node -> [22, 21, 1]
func extractVersionFromPath(path string) []int {
	// 查找 versions/node/vX.X.X 模式
	parts := strings.Split(path, string(filepath.Separator))
	for i, part := range parts {
		if part == "node" && i+1 < len(parts) {
			versionStr := parts[i+1]
			// 移除 'v' 前缀
			versionStr = strings.TrimPrefix(versionStr, "v")
			// 解析版本号
			var versions []int
			for _, v := range strings.Split(versionStr, ".") {
				if n, err := strconv.Atoi(v); err == nil {
					versions = append(versions, n)
				}
			}
			return versions
		}
	}
	return nil
}

// compareVersions 比较两个版本号
// 返回值: >0 表示 v1 > v2, =0 表示 v1 = v2, <0 表示 v1 < v2
func compareVersions(v1, v2 []int) int {
	maxLen := len(v1)
	if len(v2) > maxLen {
		maxLen = len(v2)
	}
	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(v1) {
			n1 = v1[i]
		}
		if i < len(v2) {
			n2 = v2[i]
		}
		if n1 != n2 {
			return n1 - n2
		}
	}
	return 0
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

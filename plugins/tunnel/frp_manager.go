package tunnel

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// FRPProcessManager FRP 进程管理器
type FRPProcessManager struct {
	config       *TunnelConfig
	frpcPath     string  // 使用 exec.LookPath 找到的路径
	processes    map[string]*FRPProcess
	mutex        sync.RWMutex
	emitEvent    func(eventName string, data interface{})
	app          *application.App
}

// FRPProcess FRP 进程信息
type FRPProcess struct {
	TunnelID   string
	Cmd        *exec.Cmd
	ConfigPath string
	Status     TunnelStatus
	PublicURL  string
	LastError  string
	LogPath    string
	LogFile    *os.File
	StartedAt  time.Time
}

// NewFRPProcessManager 创建 FRP 进程管理器
func NewFRPProcessManager(config *TunnelConfig, emitEvent func(eventName string, data interface{}), app *application.App) *FRPProcessManager {
	// 查找 frpc 可执行文件
	frpcPath := findFRPCExecutable(app)

	return &FRPProcessManager{
		config:       config,
		frpcPath:     frpcPath,
		processes:    make(map[string]*FRPProcess),
		emitEvent:    emitEvent,
		app:          app,
	}
}

// findFRPCExecutable 查找 frpc 可执行文件
// 支持多种安装方式：PATH、Homebrew、手动安装
func findFRPCExecutable(app *application.App) string {
	logPrefix := "[FRPManager]"

	// 创建调试日志文件
	debugLogPath := filepath.Join(os.TempDir(), "ltools_frp_debug.log")
	debugLog, err := os.OpenFile(debugLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		defer debugLog.Close()
		log.SetOutput(debugLog)
	}

	log.Printf("%s ========== Finding frpc executable ==========", logPrefix)
	log.Printf("%s GOOS: %s, GOARCH: %s", logPrefix, runtime.GOOS, runtime.GOARCH)
	log.Printf("%s Environment: HOME=%s, USER=%s, PATH=%s", logPrefix, os.Getenv("HOME"), os.Getenv("USER"), os.Getenv("PATH"))
	execName := "frpc"
	if runtime.GOOS == "windows" {
		execName = "frpc.exe"
	}

	// 1. 尝试从当前环境的 PATH 查找
	if path, err := exec.LookPath(execName); err == nil {
		if app != nil {
			app.Logger.Info(logPrefix + " Found frpc in PATH: " + path)
		}
		log.Printf("%s Found frpc via exec.LookPath: %s", logPrefix, path)
		return path
	}

	log.Printf("%s frpc not found via exec.LookPath, trying login shell...", logPrefix)

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
				if app != nil {
					app.Logger.Info(logPrefix + " Found frpc via login shell: " + foundPath)
				}
				log.Printf("%s Found frpc via login shell: %s", logPrefix, foundPath)
				return foundPath
			}
		}
	} else {
		log.Printf("%s Login shell lookup failed: %v", logPrefix, err)
	}

	if app != nil {
		app.Logger.Info(logPrefix + " frpc not found in PATH or via login shell, searching common locations...")
		app.Logger.Info(logPrefix + " Environment: HOME=" + os.Getenv("HOME") + ", USER=" + os.Getenv("USER"))
	}

	// 3. 获取 home 目录（多种方式确保可靠性）
	homeDir := os.Getenv("HOME")
	if homeDir == "" {
		var err error
		homeDir, err = os.UserHomeDir()
		if err != nil {
			log.Printf("%s Failed to get home directory: %v", logPrefix, err)
			if app != nil {
				app.Logger.Warn(logPrefix + " Failed to get home directory: " + err.Error())
			}
			// 最后尝试从用户信息获取
			homeDir = "/Users/" + os.Getenv("USER")
		}
	}

	if app != nil {
		app.Logger.Info(logPrefix + " Using home directory: " + homeDir)
	}

	// 3. 根据操作系统尝试常见路径
	var candidates []string

	switch runtime.GOOS {
	case "darwin":
		candidates = []string{
			// 用户 bin 目录（常见手动安装位置）
			filepath.Join(homeDir, "bin", "frpc"),
			// Homebrew (Apple Silicon)
			"/opt/homebrew/bin/frpc",
			// Homebrew (Intel)
			"/usr/local/bin/frpc",
			// 系统路径
			"/usr/bin/frpc",
			// 用户本地安装
			filepath.Join(homeDir, ".local", "bin", "frpc"),
			// FRP 默认安装目录
			filepath.Join(homeDir, ".frp", "frpc"),
			// 应用数据目录
			filepath.Join(homeDir, "Library", "Application Support", "ltools", "frp", "frpc"),
		}

	case "windows":
		// Windows 常见安装位置
		appData := os.Getenv("APPDATA")       // C:\Users\<user>\AppData\Roaming
		localAppData := os.Getenv("LOCALAPPDATA") // C:\Users\<user>\AppData\Local
		programFiles := os.Getenv("ProgramFiles") // C:\Program Files

		candidates = []string{
			// 用户手动安装
			filepath.Join(homeDir, "bin", "frpc.exe"),
			// Program Files
			filepath.Join(programFiles, "frp", "frpc.exe"),
			// AppData (用户安装)
			filepath.Join(appData, "frp", "frpc.exe"),
			// LocalAppData
			filepath.Join(localAppData, "frp", "frpc.exe"),
			// Scoop 安装
			filepath.Join(homeDir, "scoop", "apps", "frp", "current", "frpc.exe"),
			// Chocolatey 安装
			"C:\\ProgramData\\chocolatey\\bin\\frpc.exe",
			// 应用数据目录
			filepath.Join(appData, "ltools", "frp", "frpc.exe"),
		}

	default: // Linux 和其他系统
		candidates = []string{
			// 用户 bin 目录
			filepath.Join(homeDir, "bin", "frpc"),
			// 用户本地安装
			filepath.Join(homeDir, ".local", "bin", "frpc"),
			// 系统路径
			"/usr/bin/frpc",
			"/usr/local/bin/frpc",
			// FRP 默认安装目录
			filepath.Join(homeDir, ".frp", "frpc"),
			// Snap 安装
			"/snap/bin/frpc",
			// 应用数据目录
			filepath.Join(homeDir, ".config", "ltools", "frp", "frpc"),
		}
	}

	for i, candidate := range candidates {
		if candidate == "" {
			continue
		}
		log.Printf("%s Checking candidate #%d: %s", logPrefix, i+1, candidate)
		if info, err := os.Stat(candidate); err == nil {
			if absPath, err := filepath.Abs(candidate); err == nil {
				log.Printf("%s Found frpc at: %s (size: %d)", logPrefix, absPath, info.Size())
				if app != nil {
					app.Logger.Info(logPrefix + " Found frpc at: " + absPath)
				}
				return absPath
			}
		} else {
			log.Printf("%s Candidate #%d not found: %v", logPrefix, i+1, err)
		}
	}

	log.Printf("%s frpc not found in any of %d locations", logPrefix, len(candidates))

	if app != nil {
		app.Logger.Warn(logPrefix + " frpc not found in common locations")
	}

	return "" // 未找到
}

// NewFRPProcess 创建 FRP 进程信息
func NewFRPProcess(tunnelID string, status TunnelStatus, cmd *exec.Cmd, configPath string, logPath string) *FRPProcess {
	return &FRPProcess{
		TunnelID:   tunnelID,
		Cmd:        cmd,
		ConfigPath: configPath,
		Status:     status,
		LogPath:    logPath,
		LogFile:    nil,
		StartedAt:  time.Now(),
	}
}

// generateFRPConfig 生成 FRP 配置文件
func (pm *FRPProcessManager) generateFRPConfig(tunnelID string, tunnel *Tunnel) (string, error) {
	configDir := filepath.Join(os.Getenv("HOME"), ".ltools", "frp")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}
	configPath := filepath.Join(configDir, fmt.Sprintf("%s.toml", tunnelID))

	// 生成完整配置，包含所有必需字段
	var builder strings.Builder
	builder.WriteString("# FRP 配置文件\n\n")

	// 服务器配置
	if tunnel.FRPServer != nil {
		// 解析 Address 字段 (格式: "IP:PORT" 或 "domain:PORT")
		address := tunnel.FRPServer.Address
		// 分割地址和端口
		parts := strings.Split(address, ":")
		if len(parts) == 2 {
			serverAddr := parts[0]
			serverPort := parts[1]
			builder.WriteString(fmt.Sprintf("serverAddr = \"%s\"\n", serverAddr))
			builder.WriteString(fmt.Sprintf("serverPort = %s\n", serverPort))
		} else {
			// 如果没有端口，使用默认端口
			builder.WriteString(fmt.Sprintf("serverAddr = \"%s\"\n", address))
			builder.WriteString("serverPort = 7000\n")
		}

		if tunnel.FRPServer.Token != "" {
			builder.WriteString("auth.method = \"token\"\n")
			builder.WriteString(fmt.Sprintf("auth.token = \"%s\"\n", tunnel.FRPServer.Token))
		}
	}

	// 代理配置
	proxyType := "http"
	if tunnel.ProxyType != "" {
		proxyType = string(tunnel.ProxyType)
	}

	builder.WriteString("[[proxies]]\n")
	builder.WriteString(fmt.Sprintf("name = \"%s\"\n", tunnelID))
	builder.WriteString(fmt.Sprintf("type = \"%s\"\n", proxyType))
	builder.WriteString(fmt.Sprintf("localIP = \"%s\"\n", tunnel.LocalHost))
	builder.WriteString(fmt.Sprintf("localPort = %d\n", tunnel.LocalPort))

	// 子域名配置（在代理部分之后）
	if tunnel.Subdomain != "" && tunnel.Subdomain != "-" {
		builder.WriteString(fmt.Sprintf("subdomain = \"%s\"\n", tunnel.Subdomain))
	}
	builder.WriteString("\n")

	if err := os.WriteFile(configPath, []byte(builder.String()), 0644); err != nil {
		return "", err
	}
	return configPath, nil
}

// StartTunnel 启动 FRP 隧道
func (pm *FRPProcessManager) StartTunnel(tunnel *Tunnel) (*OperationResult, error) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Debug(fmt.Sprintf("[FRP] StartTunnel called: tunnelID=%s, server=%s, localHost=%s, localPort=%d",
			tunnel.ID, tunnel.FRPServer.Address, tunnel.LocalHost, tunnel.LocalPort))
	}

	// 检查是否已在运行
	if _, ok := pm.processes[tunnel.ID]; ok {
		return &OperationResult{
			Success: false,
			Error:   "隧道已在运行",
		}, nil
	}

	// 生成配置文件
	configPath, err := pm.generateFRPConfig(tunnel.ID, tunnel)
	if err != nil {
		return &OperationResult{
			Success: false,
			Error:   fmt.Sprintf("生成配置失败: %v", err),
		}, nil
	}

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Info(fmt.Sprintf("[FRP] Generated config: tunnelID=%s, configPath=%s", tunnel.ID, configPath))
	}

	// 创建上下文
	ctx, cancel := context.WithCancel(context.Background())

	// 构建命令 - 使用登录 shell 来继承用户的 PATH 配置
	// 这样可以找到用户在 ~/.bashrc 或 ~/.zshrc 中配置的 ~/bin 等目录
	var cmd *exec.Cmd
	frpcPath := pm.frpcPath

	if frpcPath != "" && frpcPath != "frpc" {
		// 找到了具体路径，直接使用
		if pm.app != nil {
			pm.app.Logger.Info("[FRP] Using frpc at: " + frpcPath)
		}
		cmd = exec.CommandContext(ctx, frpcPath, "-c", configPath)
	} else {
		// 使用登录 shell 执行，继承用户的环境变量
		// -l: 登录 shell，加载 ~/.bash_profile / ~/.zprofile
		// -c: 执行命令
		if pm.app != nil {
			pm.app.Logger.Info("[FRP] Using login shell to find frpc...")
		}
		shellCmd := fmt.Sprintf("frpc -c %s", configPath)
		cmd = exec.CommandContext(ctx, "/bin/bash", "-l", "-c", shellCmd)
	}

	// 设置环境变量
	if tunnel.FRPServer != nil && tunnel.FRPServer.Token != "" {
		cmd.Env = append(os.Environ(), "FRP_TOKEN="+tunnel.FRPServer.Token)
	}

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Debug(fmt.Sprintf("[FRP] Environment variables set: FRP_TOKEN=%s", tunnel.FRPServer.Token))
		log.Println("[FRP] Environment: Token:", tunnel.FRPServer.Token)
	}

	// 创建日志文件
	logPath := filepath.Join(os.TempDir(), fmt.Sprintf("frp_%s_%s.log", tunnel.ID, time.Now().Format("20060102_150405")))

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Info(fmt.Sprintf("[FRP] Creating log file: tunnelID=%s, logPath=%s", tunnel.ID, logPath))
	}

	logFile, err := os.Create(logPath)
	if err != nil {
		cancel()
		return &OperationResult{
			Success: false,
			Error:   fmt.Sprintf("创建日志文件失败: %v", err),
		}, nil
	}

	// 设置管道
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		logFile.Close()
		cancel()
		return &OperationResult{
			Success: false,
			Error:   fmt.Sprintf("创建 stdout 管道失败: %v", err),
		}, nil
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		stdout.Close()
		logFile.Close()
		cancel()
		return &OperationResult{
			Success: false,
			Error:   fmt.Sprintf("创建 stderr 管道失败: %v", err),
		}, nil
	}

	// 启动进程
	if err := cmd.Start(); err != nil {
		logFile.Close()
		stderr.Close()
		logFile.Close()
		cancel()
		return &OperationResult{
			Success: false,
			Error:   fmt.Sprintf("启动进程失败: %v", err),
		}, nil
	}

	// 创建进程对象
	process := &FRPProcess{
		TunnelID:   tunnel.ID,
		Cmd:        cmd,
		ConfigPath: configPath,
		Status:     TunnelStatusStarting,
		LogPath:    logPath,
		LogFile:    logFile,
		StartedAt:  time.Now(),
	}

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Debug(fmt.Sprintf("[FRP] Creating process: tunnelID=%s, configPath=%s, logPath=%s",
			process.TunnelID, process.ConfigPath, process.LogPath))
	}

	pm.processes[tunnel.ID] = process

	// 启动监控 goroutine
	go pm.monitorProcess(process, stdout, stderr, cancel)

	if pm.app != nil {
		pm.app.Logger.Info(fmt.Sprintf("[FRP] Tunnel %s started, monitoring...", tunnel.ID))
	}

	return &OperationResult{Success: true}, nil
}

// monitorProcess 监控进程输出
func (pm *FRPProcessManager) monitorProcess(process *FRPProcess, stdout, stderr io.ReadCloser, cancel context.CancelFunc) {
	defer cancel()

	// 打印调试信息
	if pm.app != nil {
		log.Println("[FRP] Monitor starting for tunnel: " + process.TunnelID)
		pm.app.Logger.Debug(fmt.Sprintf("[FRP] Monitor starting: %s", process.TunnelID))
	}

	// URL 提取正则 - 扩展匹配模式
	urlRegex := regexp.MustCompile(`https?://[a-zA-Z0-9.-]+`)
	startedRegex := regexp.MustCompile(`(?i)start proxy success|proxy started|running|服务已启动`)
	errorRegex := regexp.MustCompile(`(?i)error|failed`)

	// 合并 stdout 和 stderr
	reader := io.MultiReader(stdout, stderr)
	scanner := bufio.NewScanner(reader)

	lineCount := 0
	for scanner.Scan() {
		line := scanner.Text()
		lineCount++

		// 写入日志文件
		if process.LogFile != nil {
			process.LogFile.WriteString(line + "\n")
		}

		// 检测启动成功 - 扩展匹配模式
		if startedRegex.MatchString(line) && process.Status == TunnelStatusStarting {
			process.Status = TunnelStatusRunning
			if pm.app != nil {
				pm.app.Logger.Info(fmt.Sprintf("[FRP] Tunnel %s started successfully, emitting event", process.TunnelID))
			}
			pm.emitEvent("started", process.TunnelID)
			// 不 return，继续监控以检测后续错误
		}

		// 提取 URL
		if matches := urlRegex.FindAllString(line, -1); len(matches) > 0 {
			process.PublicURL = matches[0]
			pm.emitEvent("url", map[string]string{
				"tunnelId": process.TunnelID,
				"url":      process.PublicURL,
			})
		}

		// 检测错误
		if errorRegex.MatchString(line) {
			process.LastError = line
			pm.emitEvent("error", map[string]string{
				"tunnelId": process.TunnelID,
				"error":    line,
			})
		}
	}

	// 进程结束或失败
	if err := scanner.Err(); err != nil {
		process.LastError = err.Error()

		// 添加调试日志
		if pm.app != nil {
			pm.app.Logger.Error(fmt.Sprintf("[FRP] Scanner error: tunnelID=%s, error=%v", process.TunnelID, err))
				log.Printf("[FRP] Scanner error: tunnelID=%s, error=%v\n", process.TunnelID, err)
		}
	}

	// 确定最终状态
	finalStatus := TunnelStatusStopped
	if process.LastError != "" {
		// 如果有错误，状态设为 error
		finalStatus = TunnelStatusError
	}

	if pm.app != nil {
		pm.app.Logger.Info(fmt.Sprintf("[FRP] Tunnel %s process ended, final status: %s, lines read: %d", process.TunnelID, finalStatus, lineCount))
	}

	process.Status = finalStatus
	pm.emitEvent("stopped", process.TunnelID)

	// 从进程映射中删除（重要：清理失败的进程）
	pm.mutex.Lock()
	delete(pm.processes, process.TunnelID)
	pm.mutex.Unlock()

	// 关闭日志文件
	if process.LogFile != nil {
		process.LogFile.Close()
	}
}

// StopTunnel 停止隧道
func (pm *FRPProcessManager) StopTunnel(tunnelID string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	process, ok := pm.processes[tunnelID]
	if !ok {
		return fmt.Errorf("隧道未运行")
	}

	// 先更新状态为已停止
	process.Status = TunnelStatusStopped

	// 添加调试日志
	if pm.app != nil {
		pm.app.Logger.Debug(fmt.Sprintf("[FRP] StopTunnel: tunnelID=%s", tunnelID))
		log.Println("[FRP] StopTunnel called for:", tunnelID)
	}

	// 发送停止事件
	pm.emitEvent("stopped", tunnelID)

	// 发送终止信号
	if process.Cmd != nil && process.Cmd.Process != nil {
		process.Cmd.Process.Kill()
	}

	// 关闭日志文件
	if process.LogFile != nil {
		process.LogFile.Close()
	}

	// 删除进程映射
	delete(pm.processes, tunnelID)

	return nil
}

// RestartTunnel 重启隧道
func (pm *FRPProcessManager) RestartTunnel(tunnel *Tunnel) (*OperationResult, error) {
	// 停止
	pm.StopTunnel(tunnel.ID)

	// 等待一秒
	time.Sleep(1 * time.Second)

	// 重新启动
	return pm.StartTunnel(tunnel)
}

// GetAllStatuses 获取所有隧道状态
func (pm *FRPProcessManager) GetAllStatuses() []TunnelRuntimeInfo {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	var statuses []TunnelRuntimeInfo
	for _, process := range pm.processes {
		statuses = append(statuses, TunnelRuntimeInfo{
			TunnelID:  process.TunnelID,
			Status:    process.Status,
			PublicURL: process.PublicURL,
			LastError: process.LastError,
			LogPath:   process.LogPath,
		})
	}

	return statuses
}

// GetTunnelStatus 获取单个隧道状态
func (pm *FRPProcessManager) GetTunnelStatus(tunnelID string) *TunnelRuntimeInfo {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	process, ok := pm.processes[tunnelID]
	if !ok {
		return nil
	}

	return &TunnelRuntimeInfo{
		TunnelID:  process.TunnelID,
		Status:    process.Status,
		PublicURL: process.PublicURL,
		LastError: process.LastError,
		LogPath:   process.LogPath,
	}
}

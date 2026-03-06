package tunnel

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
)

const (
	PluginID      = "tunnel.builtin"
	PluginName    = "内网穿透"
	PluginVersion = "2.0.0"
)

// Tunnel 插件
type TunnelPlugin struct {
	*plugins.BasePlugin
	app           *application.App
	configMgr     *ConfigManager
	frpMgr        *FRPProcessManager
	frpInstaller  *FRPInstaller
}

// NewTunnelPlugin 创建 Tunnel 插件
func NewTunnelPlugin() *TunnelPlugin {
	trueValue := true
	metadata := &plugins.PluginMetadata{
		ID:          PluginID,
		Name:        PluginName,
		Version:     PluginVersion,
		Author:      "LTools Team",
		Description: "内网穿透工具，支持 FRP 协议",
		Icon:        "network",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionFileSystem,
			plugins.PermissionNetwork,
		},
		Keywords:   []string{"tunnel", "ngrok", "frp", "公网", "端口映射"},
		ShowInMenu: &trueValue,
	}

	return &TunnelPlugin{
		BasePlugin: plugins.NewBasePlugin(metadata),
	}
}

// Init 初始化插件
func (p *TunnelPlugin) Init(app *application.App) error {
	if err := p.BasePlugin.Init(app); err != nil {
		return err
	}
	return nil
}

// ServiceStartup 服务启动
func (p *TunnelPlugin) ServiceStartup(app *application.App) error {
	if err := p.BasePlugin.ServiceStartup(app); err != nil {
		return err
	}
	p.app = app
	return nil
}

// ServiceShutdown 服务关闭
func (p *TunnelPlugin) ServiceShutdown(app *application.App) error {
	return p.BasePlugin.ServiceShutdown(app)
}

// SetDataDir 设置数据目录
func (p *TunnelPlugin) SetDataDir(dataDir string) error {
	// 初始化配置管理器
	p.configMgr = NewConfigManager(dataDir)

	// 加载配置
	config, err := p.configMgr.LoadConfig()
	if err != nil {
		config = DefaultConfig()
		p.configMgr.Config = config
	}

	// 初始化 FRP 管理器
	// 注意：安装路径会在 FRPInstaller.Install() 时设置
	p.frpMgr = NewFRPProcessManager(config, p.emitEvent, p.app)

	// 初始化 FRP 安装器
	p.frpInstaller = NewFRPInstaller()

	return nil
}

// emitEvent 发送事件
func (p *TunnelPlugin) emitEvent(eventName string, data interface{}) {
	if p.app != nil {
		p.app.Event.Emit("tunnel:"+eventName, data)
	}
}

package musicplayer

import (
	application "github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
)

// MusicPlayerPlugin 音乐播放器插件
type MusicPlayerPlugin struct {
	*plugins.BasePlugin
	app            *application.App
	service        *Service
	windowManager  *WindowManager
}

// NewMusicPlayerPlugin 创建音乐播放器插件实例
func NewMusicPlayerPlugin() *MusicPlayerPlugin {
	metadata := &plugins.PluginMetadata{
		ID:          "musicplayer.builtin",
		Name:        "随机音乐播放器",
		Version:     "1.0.0",
		Author:      "LTools",
		Description: "基于 Meting API 的随机音乐播放器，支持网易云、腾讯、酷狗等多个平台",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionNetwork, // 需要网络权限访问音乐 API
		},
		Keywords:   []string{"音乐", "播放器", "随机", "Meting", "网易云", "QQ音乐", "酷狗"},
		ShowInMenu: boolPtr(true),
		HasPage:    boolPtr(true),
	}

	return &MusicPlayerPlugin{
		BasePlugin: plugins.NewBasePlugin(metadata),
	}
}

// Init 初始化插件
func (p *MusicPlayerPlugin) Init(app *application.App) error {
	p.app = app
	return nil
}

// ServiceStartup 服务启动
func (p *MusicPlayerPlugin) ServiceStartup(app *application.App) error {
	// 服务由 main.go 创建和注册，这里只保存引用
	return nil
}

// ServiceShutdown 服务关闭
func (p *MusicPlayerPlugin) ServiceShutdown(app *application.App) error {
	// 清理资源
	return nil
}

// GetService 获取服务实例
func (p *MusicPlayerPlugin) GetService() *Service {
	return p.service
}

// SetService 设置服务实例（由 main.go 调用）
func (p *MusicPlayerPlugin) SetService(service *Service) {
	p.service = service
}

// boolPtr 返回 bool 的指针
func boolPtr(b bool) *bool {
	return &b
}

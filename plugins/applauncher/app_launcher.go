package applauncher

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
	"ltools/internal/searchmatch"
	"ltools/plugins/applauncher/apps"
)

const (
	PluginID      = "app-launcher.builtin"
	PluginName    = "应用启动器"
	PluginVersion = "1.0.0"
)

// AppLauncherPlugin 应用启动器插件
type AppLauncherPlugin struct {
	*plugins.BasePlugin
	app      *application.App
	dataDir  string
	provider apps.AppProvider
	cache    *apps.Cache
}

// NewAppLauncherPlugin 创建插件实例
func NewAppLauncherPlugin() *AppLauncherPlugin {
	metadata := &plugins.PluginMetadata{
		ID:          PluginID,
		Name:        PluginName,
		Version:     PluginVersion,
		Author:      "LTools",
		Description: "快速启动系统中已安装的应用程序",
		Icon:        "🚀",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionFileSystem, // 读取应用路径
			plugins.PermissionProcess,    // 启动进程
		},
		Keywords:   []string{"app", "应用", "启动", "launch", "open"},
		ShowInMenu: plugins.BoolPtr(false), // 不在菜单中显示，通过快捷键/搜索调用
		HasPage:    plugins.BoolPtr(false), // 无需独立页面
	}

	base := plugins.NewBasePlugin(metadata)
	return &AppLauncherPlugin{
		BasePlugin: base,
	}
}

// Init 初始化插件
func (p *AppLauncherPlugin) Init(app *application.App) error {
	if err := p.BasePlugin.Init(app); err != nil {
		return err
	}

	p.app = app
	p.dataDir = "" // 将由 SetDataDir 设置

	return nil
}

// SetDataDir 设置数据目录
func (p *AppLauncherPlugin) SetDataDir(dataDir string) error {
	p.dataDir = dataDir

	// 创建平台特定的应用提供者
	var err error
	p.provider, err = apps.NewProvider()
	if err != nil {
		p.app.Logger.Warn(fmt.Sprintf("[AppLauncher] Provider not available: %v", err))
		// 不返回错误，插件仍然可以加载（只是功能不可用）
		return nil
	}

	// 创建缓存
	cache, err := apps.NewCache(dataDir)
	if err != nil {
		return fmt.Errorf("failed to create cache: %w", err)
	}
	p.cache = cache

	// 后台异步刷新应用列表
	go p.refreshApps()

	return nil
}

// ServiceStartup 服务启动时调用
func (p *AppLauncherPlugin) ServiceStartup(app *application.App) error {
	// app.Logger.Info("[AppLauncher] Service starting...")
	return p.BasePlugin.ServiceStartup(app)
}

// ServiceShutdown 服务关闭时调用
func (p *AppLauncherPlugin) ServiceShutdown(app *application.App) error {
	// app.Logger.Info("[AppLauncher] Service shutting down...")
	return p.BasePlugin.ServiceShutdown(app)
}

// Search 搜索应用（实现搜索接口）
func (p *AppLauncherPlugin) Search(query string) ([]*apps.AppInfo, error) {
	if p.cache == nil {
		return []*apps.AppInfo{}, nil
	}

	cachedApps, err := p.cache.Load()
	if err != nil {
		p.app.Logger.Error(fmt.Sprintf("[AppLauncher] Failed to load cache: %v", err))
		return []*apps.AppInfo{}, nil
	}

	// 检查缓存是否过期，后台刷新
	if p.cache.IsExpired(24 * time.Hour) {
		go p.refreshApps()
	}

	// 过滤匹配的应用
	results := []*apps.AppInfo{}
	queryLower := strings.ToLower(query)

	for _, app := range cachedApps {
		if p.matchApp(app, queryLower) {
			results = append(results, app)
		}
	}
	sort.SliceStable(results, func(i, j int) bool {
		left, right := searchmatch.Score(results[i].Name, query), searchmatch.Score(results[j].Name, query)
		if left == right {
			return results[i].Name < results[j].Name
		}
		return left > right
	})

	return results, nil
}

// LaunchApp 启动应用
func (p *AppLauncherPlugin) LaunchApp(appID string) error {
	if p.cache == nil {
		return fmt.Errorf("cache not available")
	}

	cachedApps, err := p.cache.Load()
	if err != nil {
		return fmt.Errorf("failed to load apps: %w", err)
	}

	for _, app := range cachedApps {
		if app.ID == appID {
			p.app.Logger.Info(fmt.Sprintf("[AppLauncher] Launching app: %s", app.Name))
			return p.provider.LaunchApp(app)
		}
	}

	return fmt.Errorf("app not found: %s", appID)
}

// RefreshCache 手动刷新缓存
func (p *AppLauncherPlugin) RefreshCache() error {
	return p.refreshApps()
}

// GetCacheStatus 获取缓存状态
func (p *AppLauncherPlugin) GetCacheStatus() map[string]interface{} {
	if p.cache == nil {
		return map[string]interface{}{
			"available": false,
		}
	}

	status := p.cache.Status()
	status["available"] = true
	return status
}

// refreshApps 刷新应用列表
func (p *AppLauncherPlugin) refreshApps() error {
	if p.provider == nil {
		return fmt.Errorf("provider not available")
	}

	p.app.Logger.Info("[AppLauncher] Refreshing app list...")

	appList, err := p.provider.ListApps()
	if err != nil {
		p.app.Logger.Error(fmt.Sprintf("[AppLauncher] Failed to list apps: %v", err))
		return err
	}

	// 提取真实的应用图标
	for _, app := range appList {
		if app.IconPath != "" && app.IconData == "" {
			iconData, err := apps.ExtractIcon(app.IconPath)
			if err == nil && iconData != "" {
				app.IconData = iconData
				// p.app.Logger.Info(fmt.Sprintf("[AppLauncher] Extracted icon for: %s", app.Name))
			} else {
				// 图标提取失败，使用默认 emoji 图标
				app.IconData = apps.GetAppDefaultIcon(app.Name)
				// p.app.Logger.Debug(fmt.Sprintf("[AppLauncher] Using default icon for %s: %v", app.Name, err))
			}
		} else if app.IconData == "" {
			// 没有图标路径，使用默认图标
			app.IconData = apps.GetAppDefaultIcon(app.Name)
		}
	}

	if err := p.cache.Save(appList); err != nil {
		p.app.Logger.Error(fmt.Sprintf("[AppLauncher] Failed to save cache: %v", err))
		return err
	}

	// p.app.Logger.Info(fmt.Sprintf("[AppLauncher] Refreshed %d apps", len(appList)))
	return nil
}

// matchApp 检查应用是否匹配查询
func (p *AppLauncherPlugin) matchApp(app *apps.AppInfo, query string) bool {
	if query == "" {
		return false
	}

	return searchmatch.Score(app.Name, query) > 0 ||
		strings.Contains(strings.ToLower(app.Description), strings.ToLower(query))
}

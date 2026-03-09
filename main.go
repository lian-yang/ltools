package main

import (
	"embed"
	_ "embed"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"ltools/internal/plugins"
	"ltools/internal/proxy"
	"ltools/internal/sync"
	"ltools/internal/update"
	"ltools/plugins/applauncher"
	"ltools/plugins/bookmark"
	"ltools/plugins/calculator"
	"ltools/plugins/clipboard"
	"ltools/plugins/datetime"
	"ltools/plugins/hosts"
	"ltools/plugins/imagebed"
	"ltools/plugins/ipinfo"
	"ltools/plugins/jsoneditor"
	"ltools/plugins/kanban"
	"ltools/plugins/localtranslate"
	"ltools/plugins/markdown"
	"ltools/plugins/musicplayer"
	"ltools/plugins/password"
	"ltools/plugins/processmanager"
	"ltools/plugins/qrcode"
	"ltools/plugins/screenshot2"
	"ltools/plugins/sticky"
	"ltools/plugins/sysinfo"
	"ltools/plugins/tunnel"
	"ltools/plugins/vault"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var systrayIcon []byte

// 版本号，通过 -ldflags 在编译时注入
// 示例: go build -ldflags="-X main.version=0.1.2"
var version = "0.1.0" // 默认值，开发时使用

func init() {
	// Register custom events for the datetime plugin
	application.RegisterEvent[string]("datetime:current")
	application.RegisterEvent[string]("datetime:time")
	application.RegisterEvent[string]("datetime:date")
	application.RegisterEvent[string]("datetime:datetime")
	application.RegisterEvent[string]("datetime:weekday")
	application.RegisterEvent[int]("datetime:year")
	application.RegisterEvent[int]("datetime:month")
	application.RegisterEvent[int]("datetime:day")
	application.RegisterEvent[int]("datetime:hour")
	application.RegisterEvent[int]("datetime:minute")
	application.RegisterEvent[int]("datetime:second")

	// Register custom events for the calculator plugin
	application.RegisterEvent[string]("calculator:result")
	application.RegisterEvent[string]("calculator:error")
	application.RegisterEvent[string]("calculator:history")

	// Register custom events for the clipboard plugin
	application.RegisterEvent[string]("clipboard:new")
	application.RegisterEvent[string]("clipboard:cleared")
	application.RegisterEvent[string]("clipboard:deleted")
	application.RegisterEvent[string]("clipboard:count")
	application.RegisterEvent[string]("clipboard:heartbeat")
	application.RegisterEvent[string]("clipboard:permission:requested")

	// Register custom events for the system info plugin
	application.RegisterEvent[string]("sysinfo:updated")
	application.RegisterEvent[string]("sysinfo:cpu")
	application.RegisterEvent[string]("sysinfo:uptime")
	application.RegisterEvent[string]("sysinfo:gc")
	application.RegisterEvent[string]("sysinfo:maxprocs")

	// Register custom events for the shortcut service
	application.RegisterEvent[string]("shortcut:triggered")

	// Register event for permission requirement (sends map with title, message, platform)
	// We need to define the event type - using map[string]interface{} for flexibility
	// Note: Wails v3 events need a specific type, so we'll use string for the data
	application.RegisterEvent[string]("shortcut:permission-required")

	// Register custom events for the screenshot2 plugin (WeChat-style)
	application.RegisterEvent[string]("screenshot2:started")
	application.RegisterEvent[string]("screenshot2:captured")
	application.RegisterEvent[string]("screenshot2:saved")
	application.RegisterEvent[string]("screenshot2:copied")
	application.RegisterEvent[string]("screenshot2:cancelled")
	application.RegisterEvent[string]("screenshot2:error")
	application.RegisterEvent[string]("screenshot2:session-start")
	application.RegisterEvent[string]("screenshot2:session-end")
	application.RegisterEvent[string]("screenshot2:image-data")
	application.RegisterEvent[string]("screenshot2:displays-info")

	// Register custom events for the JSON editor plugin
	application.RegisterEvent[string]("jsoneditor:formatted")
	application.RegisterEvent[string]("jsoneditor:error")
	application.RegisterEvent[bool]("jsoneditor:validated")

	// Register custom events for the process manager plugin
	application.RegisterEvent[string]("processmanager:updated")
	application.RegisterEvent[string]("processmanager:killed")
	application.RegisterEvent[string]("processmanager:error")

	// Register custom events for qrcode plugin
	application.RegisterEvent[string]("qrcode:generated")
	application.RegisterEvent[string]("qrcode:copied")
	application.RegisterEvent[string]("qrcode:saved")

	// Register custom events for the hosts plugin
	application.RegisterEvent[string]("hosts:scenario:created")
	application.RegisterEvent[string]("hosts:scenario:updated")
	application.RegisterEvent[string]("hosts:scenario:deleted")
	application.RegisterEvent[string]("hosts:scenario:switched")
	application.RegisterEvent[string]("hosts:backup:created")
	application.RegisterEvent[string]("hosts:backup:restored")
	application.RegisterEvent[string]("hosts:backup:deleted")
	application.RegisterEvent[string]("hosts:entry:added")
	application.RegisterEvent[string]("hosts:entry:updated")
	application.RegisterEvent[string]("hosts:entry:removed")
	application.RegisterEvent[string]("hosts:error")

	// Register custom events for tunnel plugin
	application.RegisterEvent[string]("tunnel:install:progress")
	application.RegisterEvent[string]("tunnel:created")
	application.RegisterEvent[string]("tunnel:updated")
	application.RegisterEvent[string]("tunnel:deleted")
	application.RegisterEvent[string]("tunnel:started")
	application.RegisterEvent[string]("tunnel:stopped")
	application.RegisterEvent[any]("tunnel:error")
	application.RegisterEvent[string]("tunnel:restarting")
	application.RegisterEvent[any]("tunnel:url")
	application.RegisterEvent[any]("tunnel:log")
	application.RegisterEvent[string]("tunnel:options:updated")

	// Register notification event for user notifications
	application.RegisterEvent[string]("notification:show")

	// Register custom events for the search window service
	application.RegisterEvent[string]("search:opened")
	application.RegisterEvent[string]("search:closed")
	application.RegisterEvent[[]*plugins.SearchResult]("search:results")

	// Register custom events for the kanban plugin
	application.RegisterEvent[string]("kanban:board:created")
	application.RegisterEvent[string]("kanban:board:updated")
	application.RegisterEvent[string]("kanban:board:deleted")
	application.RegisterEvent[string]("kanban:column:created")
	application.RegisterEvent[string]("kanban:column:updated")
	application.RegisterEvent[string]("kanban:column:deleted")
	application.RegisterEvent[string]("kanban:column:moved")
	application.RegisterEvent[string]("kanban:card:created")
	application.RegisterEvent[string]("kanban:card:updated")
	application.RegisterEvent[string]("kanban:card:deleted")
	application.RegisterEvent[string]("kanban:card:moved")
	application.RegisterEvent[string]("kanban:card:completed")
	application.RegisterEvent[string]("kanban:card:uncompleted")
	application.RegisterEvent[string]("kanban:label:created")
	application.RegisterEvent[string]("kanban:label:updated")
	application.RegisterEvent[string]("kanban:label:deleted")
	application.RegisterEvent[string]("kanban:checklist:added")
	application.RegisterEvent[string]("kanban:checklist:toggled")
	application.RegisterEvent[string]("kanban:checklist:updated")
	application.RegisterEvent[string]("kanban:checklist:removed")

	// Register custom events for the bookmark plugin
	application.RegisterEvent[string]("bookmark:sync-started")
	application.RegisterEvent[string]("bookmark:sync-completed")
	application.RegisterEvent[string]("bookmark:sync-error")
	application.RegisterEvent[string]("bookmark:exported")

	// Register custom events for the sticky plugin
	application.RegisterEvent[string]("sticky:created")
	application.RegisterEvent[string]("sticky:updated")
	application.RegisterEvent[string]("sticky:deleted")

	// Register custom events for the imagebed plugin
	application.RegisterEvent[string]("imagebed:uploaded")
	application.RegisterEvent[string]("imagebed:deleted")
	application.RegisterEvent[string]("imagebed:error")

	// Register custom events for the localtranslate plugin
	application.RegisterEvent[string]("localtranslate:show-window")
	application.RegisterEvent[string]("localtranslate:started")
	application.RegisterEvent[string]("localtranslate:completed")
	application.RegisterEvent[string]("localtranslate:error")

	// Register custom events for the update service
	application.RegisterEvent[*update.UpdateInfo]("update:available")
	application.RegisterEvent[int]("update:progress")

	// Register custom event for file open (file association)
	application.RegisterEvent[string]("file:open")

	// Register custom event for URL open (custom protocol)
	application.RegisterEvent[map[string]string]("url:open")
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// registers plugins, and runs the application.
func main() {

	// Create proxy manager for all plugins
	proxyManager := proxy.NewProxyManager(&proxy.ProxyConfig{
		RequestTimeout:  30 * time.Second,
		MaxRetries:      2,
		EnableCache:     true,
		CacheTTL:        30 * time.Minute,
		MaxCacheEntries: 1000,
		EnableLogging:   true,
	})

	// 创建组合资源处理器：代理请求 + 静态文件
	proxyHandler := NewCombinedAssetHandler(proxyManager, application.AssetFileServerFS(assets))

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Services' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "ltools",
		Description: "A plugin-based desktop toolbox",
		Assets: application.AssetOptions{
			Handler: proxyHandler,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false, // 保持应用在窗口关闭后运行
		},
		// 参考 https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags?tabs=dotnetcsharp
		Windows: application.WindowsOptions{
			EnabledFeatures: []string{
				"ignore-certificate-errors",      // 忽略与证书相关的错误
				"allow-insecure-localhost",       // 允许忽略本地主机上的 TLS/SSL 错误
				"allow-running-insecure-content", // 解除对从 HTTP 源提供内容的 MSP 的阻止
				"autoplay-policy",                // 允许自动播放策略
			},
			DisabledFeatures: []string{},
			AdditionalBrowserArgs: []string{
				"--disable-web-security", // 禁用同源策略
			}, // webview2 启动参数
		},
	})

	// 设置 proxyHandler 的 app 引用，用于访问环境信息
	proxyHandler.SetApp(app)

	// 监听文件打开事件（文件关联）
	app.Event.OnApplicationEvent(events.Common.ApplicationOpenedWithFile, func(e *application.ApplicationEvent) {
		filePath := e.Context().Filename()
		log.Printf("[Main] File opened via association: %s", filePath)
		// 发送事件到前端，让前端处理文件打开
		app.Event.Emit("file:open", filePath)
	})

	// 注意：URL 打开事件监听已移至 SearchWindowService 创建之后
	// 见下方 "Set the main window reference in SearchWindowService" 之后

	// 创建系统托盘
	systray := app.SystemTray.New()
	systray.SetIcon(systrayIcon)
	systray.SetLabel("LTools")

	// 保存主窗口引用，用于系统托盘菜单
	var mainWindow *application.WebviewWindow

	// 创建系统托盘菜单
	menu := app.NewMenu()
	menu.Add("显示窗口").OnClick(func(_ *application.Context) {
		if mainWindow != nil {
			mainWindow.Show()
		}
	})
	menu.Add("隐藏窗口").OnClick(func(_ *application.Context) {
		if mainWindow != nil {
			mainWindow.Hide()
		}
	})
	menu.AddSeparator()
	menu.Add("关于 LTools").OnClick(func(_ *application.Context) {
		if mainWindow != nil {
			// 显示并聚焦窗口
			mainWindow.Show()
			mainWindow.Focus()
			// 通过事件通知前端导航到关于页面，避免页面重新加载
			app.Event.Emit("navigate:to", map[string]string{
				"path": "/settings",
				"tab":  "about",
			})
		}
	})
	menu.AddSeparator()
	menu.Add("退出").OnClick(func(_ *application.Context) {
		app.Quit()
	})

	systray.SetMenu(menu)

	// Get user data directory for plugin storage
	userDataDir, err := os.UserConfigDir()
	if err != nil {
		log.Fatal("Failed to get user config dir:", err)
	}
	dataDir := filepath.Join(userDataDir, "ltools")

	// Create plugin manager
	pluginManager, err := plugins.NewManager(app, dataDir)
	if err != nil {
		log.Fatal("Failed to create plugin manager:", err)
	}

	// Create and register the datetime plugin
	datetimePlugin := datetime.NewDateTimePlugin()
	if err := pluginManager.Register(datetimePlugin); err != nil {
		log.Fatal("Failed to register datetime plugin:", err)
	}

	// Create and register password plugin
	passwordPlugin := password.NewPasswordPlugin()
	if err := pluginManager.Register(passwordPlugin); err != nil {
		log.Fatal("Failed to register password plugin:", err)
	}

	// Create and register the calculator plugin
	calculatorPlugin := calculator.NewCalculatorPlugin()
	if err := pluginManager.Register(calculatorPlugin); err != nil {
		log.Fatal("Failed to register calculator plugin:", err)
	}

	// Create and register the clipboard plugin
	clipboardPlugin := clipboard.NewClipboardPlugin()
	if err := pluginManager.Register(clipboardPlugin); err != nil {
		log.Fatal("Failed to register clipboard plugin:", err)
	}

	// Create and register the system info plugin
	sysInfoPlugin := sysinfo.NewSysInfoPlugin()
	if err := pluginManager.Register(sysInfoPlugin); err != nil {
		log.Fatal("Failed to register sysinfo plugin:", err)
	}

	// Create and register the JSON editor plugin
	jsonEditorPlugin := jsoneditor.NewJSONEditorPlugin()
	if err := pluginManager.Register(jsonEditorPlugin); err != nil {
		log.Fatal("Failed to register jsoneditor plugin:", err)
	}

	// Create and register the markdown editor plugin
	markdownPlugin := markdown.NewMarkdownPlugin()
	if err := pluginManager.Register(markdownPlugin); err != nil {
		log.Fatal("Failed to register markdown plugin:", err)
	}

	// Create and register the process manager plugin
	processManagerPlugin := processmanager.NewProcessManagerPlugin()
	if err := pluginManager.Register(processManagerPlugin); err != nil {
		log.Fatal("Failed to register processmanager plugin:", err)
	}

	// Create and register the screenshot2 plugin (WeChat-style)
	screenshot2Plugin := screenshot2.NewScreenshot2Plugin()
	if err := pluginManager.Register(screenshot2Plugin); err != nil {
		log.Fatal("Failed to register screenshot2 plugin:", err)
	}

	// Create and register the app launcher plugin
	appLauncherPlugin := applauncher.NewAppLauncherPlugin()
	if err := pluginManager.Register(appLauncherPlugin); err != nil {
		log.Fatal("Failed to register applauncher plugin:", err)
	}
	// 设置数据目录
	if err := appLauncherPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for app launcher: %v", err)
	}

	// Create and register qrcode plugin
	qrcodePlugin := qrcode.NewQrcodePlugin()
	if err := pluginManager.Register(qrcodePlugin); err != nil {
		log.Fatal("Failed to register qrcode plugin:", err)
	}

	// Create and register hosts plugin
	hostsPlugin := hosts.NewHostsPlugin()
	if err := pluginManager.Register(hostsPlugin); err != nil {
		log.Fatal("Failed to register hosts plugin:", err)
	}
	// Set data directory for hosts plugin
	if err := hostsPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for hosts plugin: %v", err)
	}

	// Create and register tunnel plugin
	tunnelPlugin := tunnel.NewTunnelPlugin()
	if err := pluginManager.Register(tunnelPlugin); err != nil {
		log.Fatal("Failed to register tunnel plugin:", err)
	}
	// Set data directory for tunnel plugin
	if err := tunnelPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for tunnel plugin: %v", err)
	}

	// Create and register kanban plugin
	kanbanPlugin := kanban.NewKanbanPlugin()
	if err := pluginManager.Register(kanbanPlugin); err != nil {
		log.Fatal("Failed to register kanban plugin:", err)
	}
	// Set data directory for kanban plugin
	if err := kanbanPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for kanban plugin: %v", err)
	}

	// Create and register vault plugin (password manager)
	vaultPlugin := vault.NewVaultPlugin(dataDir)
	if err := pluginManager.Register(vaultPlugin); err != nil {
		log.Fatal("Failed to register vault plugin:", err)
	}

	// Create and register bookmark plugin
	bookmarkPlugin := bookmark.NewBookmarkPlugin()
	if err := pluginManager.Register(bookmarkPlugin); err != nil {
		log.Fatal("Failed to register bookmark plugin:", err)
	}
	// Set data directory for bookmark plugin
	if err := bookmarkPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for bookmark plugin: %v", err)
	}

	// Create and register ipinfo plugin
	ipinfoPlugin := ipinfo.NewPlugin()
	if err := pluginManager.Register(ipinfoPlugin); err != nil {
		log.Fatal("Failed to register ipinfo plugin:", err)
	}

	// Create and register sticky plugin
	stickyPlugin := sticky.NewStickyPlugin()
	if err := pluginManager.Register(stickyPlugin); err != nil {
		log.Fatal("Failed to register sticky plugin:", err)
	}
	// Set data directory for sticky plugin
	if err := stickyPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for sticky plugin: %v", err)
	}

	// Create and register imagebed plugin
	imagebedPlugin := imagebed.NewImageBedPlugin()
	if err := pluginManager.Register(imagebedPlugin); err != nil {
		log.Fatal("Failed to register imagebed plugin:", err)
	}
	// Set data directory for imagebed plugin
	if err := imagebedPlugin.SetDataDir(dataDir); err != nil {
		log.Printf("[Main] Failed to set data dir for imagebed plugin: %v", err)
	}

	// Create and register localtranslate plugin
	localTranslatePlugin := localtranslate.NewLocalTranslatePlugin()
	if err := pluginManager.Register(localTranslatePlugin); err != nil {
		log.Fatal("Failed to register localtranslate plugin:", err)
	}

	// Create and register musicplayer plugin
	musicPlayerPlugin := musicplayer.NewMusicPlayerPlugin()
	if err := pluginManager.Register(musicPlayerPlugin); err != nil {
		log.Fatal("Failed to register musicplayer plugin:", err)
	}

	// Start all enabled plugins - this calls ServiceStartup() on each enabled plugin
	// This is crucial for plugins like clipboard that need to start background monitoring
	if err := pluginManager.StartupAll(); err != nil {
		log.Fatal("Failed to startup plugins:", err)
	}

	// Create plugin service to expose plugin management to frontend
	pluginService := plugins.NewPluginService(pluginManager, app)

	// Create datetime service to expose datetime functionality to frontend
	datetimeService := datetime.NewDateTimeService(datetimePlugin)

	// Create password service to expose password functionality to frontend
	passwordService := password.NewPasswordService(passwordPlugin, app)

	// Create calculator service to expose calculator functionality to frontend
	calculatorService := calculator.NewCalculatorService(calculatorPlugin, app)

	// Create clipboard service to expose clipboard functionality to frontend
	clipboardService := clipboard.NewClipboardService(clipboardPlugin, app)

	// Create system info service to expose system info functionality to frontend
	sysInfoService := sysinfo.NewSysInfoService(sysInfoPlugin, app)

	// Create JSON editor service to expose JSON editor functionality to frontend
	jsonEditorService := jsoneditor.NewJSONEditorService(jsonEditorPlugin, app)

	// Create markdown editor service to expose markdown editor functionality to frontend
	markdownService := markdown.NewMarkdownService(markdownPlugin, app)

	// Create process manager service to expose process manager functionality to frontend
	processManagerService := processmanager.NewProcessManagerService(processManagerPlugin, app)

	// Create screenshot2 window manager (WeChat-style multi-window)
	screenshot2WindowManager := screenshot2.NewWindowManager(screenshot2Plugin, app)

	// Create screenshot2 service to expose screenshot2 functionality to frontend
	screenshot2Service := screenshot2.NewScreenshot2Service(screenshot2Plugin, app)
	// Set window manager reference
	screenshot2Service.SetWindowManager(screenshot2WindowManager)

	// Create app launcher service to expose app launcher functionality to frontend
	appLauncherService := applauncher.NewAppLauncherService(app, appLauncherPlugin)

	// Create qrcode service to expose qrcode functionality to frontend
	qrcodeService := qrcode.NewQrcodeService(qrcodePlugin, app)

	// Create hosts service to expose hosts functionality to frontend
	hostsService := hosts.NewHostsService(hostsPlugin, app, dataDir)

	// Create tunnel service to expose tunnel functionality to frontend
	tunnelService := tunnel.NewTunnelService(tunnelPlugin, app, dataDir)

	// Create kanban service to expose kanban functionality to frontend
	kanbanService := kanban.NewKanbanService(kanbanPlugin, app, dataDir)

	// Create vault service to expose vault functionality to frontend
	vaultService := vault.NewVaultService(vaultPlugin, app)

	// Create bookmark service to expose bookmark functionality to frontend
	bookmarkService := bookmark.NewBookmarkService(app, bookmarkPlugin)

	// Create ipinfo service to expose ipinfo functionality to frontend
	ipinfoService := ipinfo.NewService(ipinfoPlugin, app)

	// Create sticky service to expose sticky functionality to frontend
	stickyService := sticky.NewStickyService(stickyPlugin, app, dataDir)

	// Create imagebed service to expose imagebed functionality to frontend
	imagebedService := imagebed.NewImageBedService(imagebedPlugin, app)

	// Create localtranslate service to expose local translation functionality to frontend
	localTranslateService := localtranslate.NewLocalTranslateService(localTranslatePlugin, app)

	// Create musicplayer service to expose music player functionality to frontend
	log.Println("[DEBUG] About to create musicplayer service...")
	musicPlayerProxyAdapter := proxy.NewMusicPlayerAdapter(proxyManager)
	log.Println("[DEBUG] Creating ServiceLX...")
	musicPlayerServiceLX, err := musicplayer.NewServiceLX(musicPlayerPlugin, app, musicPlayerProxyAdapter)
	if err != nil {
		log.Printf("[ERROR] Failed to create musicplayer service: %v", err)
	} else {
		log.Println("[SUCCESS] ServiceLX created successfully, setting service...")
		musicPlayerPlugin.SetService(musicPlayerServiceLX)
		log.Printf("[INFO] Using LX Music service")

		// Register service to app
		app.RegisterService(application.NewService(musicPlayerServiceLX))
		log.Println("[SUCCESS] LX Music service registered to app")
	}

	// Create shortcut service to expose keyboard shortcut management to frontend
	shortcutService, err := plugins.NewShortcutService(app, dataDir)
	if err != nil {
		log.Fatal("Failed to create shortcut service:", err)
	}

	// Create sync service for Git-based data synchronization
	syncService, err := sync.NewSyncService(app, dataDir)
	if err != nil {
		log.Fatal("Failed to create sync service:", err)
	}

	// Create search window service for global search functionality
	searchWindowService := plugins.NewSearchWindowService(app, pluginService, shortcutService)
	// Set app launcher service for app search integration
	searchWindowService.SetAppLauncherService(appLauncherService)

	// Create update service
	// Note: version is injected at build time via -ldflags
	// Example: go build -ldflags="-X main.version=0.1.2"
	updateService := update.NewService(&update.ServiceConfig{
		CurrentVersion: version,
		UpdateURL:      "https://raw.githubusercontent.com/lian-yang/ltools/main/",
		DataDir:        dataDir,
		Enabled:        true, // TODO: 从用户配置读取
	}, app)

	// Register services
	app.RegisterService(application.NewService(pluginService))
	app.RegisterService(application.NewService(datetimeService))
	app.RegisterService(application.NewService(passwordService))
	app.RegisterService(application.NewService(calculatorService))
	app.RegisterService(application.NewService(clipboardService))
	app.RegisterService(application.NewService(sysInfoService))
	app.RegisterService(application.NewService(jsonEditorService))
	app.RegisterService(application.NewService(markdownService))
	app.RegisterService(application.NewService(processManagerService))
	app.RegisterService(application.NewService(screenshot2Service))
	app.RegisterService(application.NewService(appLauncherService))
	app.RegisterService(application.NewService(qrcodeService))
	app.RegisterService(application.NewService(hostsService))
	app.RegisterService(application.NewService(tunnelService))
	app.RegisterService(application.NewService(kanbanService))
	app.RegisterService(application.NewService(vaultService))
	app.RegisterService(application.NewService(bookmarkService))
	app.RegisterService(application.NewService(ipinfoService))
	app.RegisterService(application.NewService(stickyService))
	app.RegisterService(application.NewService(imagebedService))
	app.RegisterService(application.NewService(localTranslateService))
	// musicPlayerService already registered above (line 518-523)
	app.RegisterService(application.NewService(shortcutService))
	app.RegisterService(application.NewService(searchWindowService))
	app.RegisterService(application.NewService(syncService))

	 // Start sync service
    if err := syncService.ServiceStartup(app); err != nil {
        log.Printf("Failed to start sync service: %v", err)
    }
	app.RegisterService(application.NewService(updateService))

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	mainWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "LTools",
		Width:     1400,
		Height:    900,
		MinWidth:  1400,
		MinHeight: 900,
		//DisableResize:       true,                      // 禁用调整大小
		MinimiseButtonState: application.ButtonEnabled, // 开启最小化按钮
		MaximiseButtonState: application.ButtonEnabled, // 开启最大化按钮
		UseApplicationMenu:  true,                      // 使用应用程序菜单（对 macOS 无影响）
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBar{
				HideTitle:          true, // 隐藏标题文字
				AppearsTransparent: true, // 标题栏透明
				FullSizeContent:    true, // 内容延伸到标题栏区域（关键！）
			},
			Backdrop:                application.MacBackdropTransparent,
			InvisibleTitleBarHeight: 40, // 不可见标题栏区域（用于拖动）的高度
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
		Windows: application.WindowsWindow{
			Permissions: map[application.CoreWebView2PermissionKind]application.CoreWebView2PermissionState{
				application.CoreWebView2PermissionKindCamera:        application.CoreWebView2PermissionStateAllow, // 相机权限
				application.CoreWebView2PermissionKindMicrophone:    application.CoreWebView2PermissionStateAllow, // 麦克风权限
				application.CoreWebView2PermissionKindNotifications: application.CoreWebView2PermissionStateAllow, // 通知权限
			},
		},
	})

	// 监听主窗口关闭事件，隐藏窗口而非销毁（系统托盘应用模式）
	mainWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		mainWindow.Hide()
		e.Cancel() // 阻止窗口真正关闭
	})

	// Start the search window service
	searchWindowService.ServiceStartup(app)

	// Start the shortcut service AFTER window is created
	// This is crucial for Wails v3 KeyBinding API to work properly
	if err := shortcutService.ServiceStartup(app); err != nil {
		log.Printf("Failed to start shortcut service: %v", err)
	}

	// Set the main window reference in ShortcutService so it can focus the window
	shortcutService.SetMainWindow(mainWindow)

	// Set the main window reference in SearchWindowService so it can show the main window
	searchWindowService.SetMainWindow(mainWindow)

	// 监听 URL 打开事件（自定义协议 ltools://）
	// 注意：此监听必须在 SearchWindowService 和 mainWindow 创建之后设置
	app.Event.OnApplicationEvent(events.Common.ApplicationLaunchedWithUrl, func(e *application.ApplicationEvent) {
		url := e.Context().URL()
		log.Printf("[Main] URL opened via custom protocol: %s", url)

		// 解析 ltools:// 协议 URL
		// 支持格式:
		// - ltools://settings?tab=about
		// - ltools://plugins/{pluginId}?param=xxx
		// - ltools://search?q=keyword
		if len(url) > 9 && url[:9] == "ltools://" {
			path := url[9:] // 移除 "ltools://" 前缀
			log.Printf("[Main] Parsed ltools URL path: %s", path)

			// 对于非搜索 URL，先确保主窗口获得焦点
			if !strings.HasPrefix(path, "search") {
				// 如果搜索窗口可见，先隐藏它
				if searchWindowService.IsVisible() {
					log.Printf("[Main] Hiding search window before opening URL")
					searchWindowService.Hide()
				}
				// 显示并聚焦主窗口
				if mainWindow != nil {
					log.Printf("[Main] Showing and focusing main window")
					mainWindow.Show()
					mainWindow.Focus()
				}
			}

			// 发送事件到前端，让前端处理导航
			app.Event.Emit("url:open", map[string]string{
				"url":  url,
				"path": path,
			})
		}
	})

	// Set the main window reference in Screenshot2WindowManager
	screenshot2WindowManager.SetMainWindow(mainWindow)

	// Start the screenshot2 window manager
	if err := screenshot2WindowManager.ServiceStartup(app); err != nil {
		log.Printf("Failed to start screenshot2 window manager: %v", err)
	}

	// Start the localtranslate service
	if err := localTranslateService.ServiceStartup(app); err != nil {
		log.Printf("Failed to start localtranslate service: %v", err)
	}

	// Register default search window hotkey (Cmd+5 / Ctrl+5)
	// Using Cmd+5 which might work better with gohook
	// Note: This will override the sysinfo plugin's shortcut
	searchHotkey := "cmd+5" // macOS
	if runtime.GOOS != "darwin" {
		searchHotkey = "ctrl+5" // Windows/Linux
	}

	// Remove old search window shortcuts if they exist
	// Also remove cmd+5 which is currently used by sysinfo plugin
	oldShortcuts := []string{"cmd+space", "ctrl+space", "cmd+shift+p", "ctrl+shift+p", "alt+space", "cmd+k", "ctrl+k", "cmd+9", "ctrl+9", "cmd+l", "ctrl+l", "cmd+6", "ctrl+6", "cmd+5", "ctrl+5"}
	for _, oldShortcut := range oldShortcuts {
		if err := shortcutService.RemoveShortcut(oldShortcut); err != nil {
			// Ignore errors - the shortcut might not exist
			log.Printf("[Main] Note: %s (may not exist): %v", oldShortcut, err)
		}
	}

	// Try to set the default search shortcut
	// If it conflicts, we'll let the user know
	if err := shortcutService.SetShortcut(searchHotkey, "search.window.builtin"); err != nil {
		log.Printf("[Main] Failed to set default search hotkey %s: %v (may conflict with existing shortcut)", searchHotkey, err)
	} else {
		log.Printf("[Main] Default search hotkey registered: %s", searchHotkey)
	}

	// Register default screenshot hotkey (Cmd+Shift+S / Ctrl+Shift+S)
	// Using S for Screenshot - stable letter key combination
	// Note: Avoid cmd+shift+6 as it's unstable (see docs/keycode/safe-shortcuts.md)
	screenshotHotkey := "cmd+shift+s"
	if runtime.GOOS != "darwin" {
		screenshotHotkey = "ctrl+shift+s" // Windows/Linux
	}

	if err := shortcutService.SetShortcut(screenshotHotkey, "screenshot2.window.builtin"); err != nil {
		log.Printf("[Main] Failed to set screenshot2 hotkey %s: %v (may conflict with existing shortcut)", screenshotHotkey, err)
	} else {
		log.Printf("[Main] Default screenshot2 hotkey registered: %s", screenshotHotkey)
	}

	// Register default sticky note hotkey (Alt+T)
	// Using Alt+T for sTicky note - simple and intuitive
	stickyHotkey := "alt+t"

	if err := shortcutService.SetShortcut(stickyHotkey, "sticky.builtin"); err != nil {
		log.Printf("[Main] Failed to set sticky hotkey %s: %v (may conflict with existing shortcut)", stickyHotkey, err)
	} else {
		log.Printf("[Main] Default sticky hotkey registered: %s", stickyHotkey)
	}

	// Register default localtranslate hotkey (Cmd+Shift+T / Ctrl+Shift+T)
	// Using T for Translate - intuitive and consistent across platforms
	translateHotkey := "cmd+shift+t"
	if runtime.GOOS != "darwin" {
		translateHotkey = "ctrl+shift+t" // Windows/Linux
	}

	if err := shortcutService.SetShortcut(translateHotkey, "localtranslate.builtin"); err != nil {
		log.Printf("[Main] Failed to set localtranslate hotkey %s: %v (may conflict with existing shortcut)", translateHotkey, err)
	} else {
		log.Printf("[Main] Default localtranslate hotkey registered: %s", translateHotkey)
	}

	// Check for updates in background (delayed 10 seconds to not block startup)
	go func() {
		time.Sleep(10 * time.Second)
		if updateService.IsEnabled() {
			info, err := updateService.CheckForUpdate()
			if err != nil {
				log.Printf("[Main] Failed to check for updates: %v", err)
				return
			}
			if info != nil {
				log.Printf("[Main] Update available: %s", info.Version)
				// Emit event to frontend
				app.Event.Emit("update:available", info)
			}
		}
	}()

	// Run the application. This blocks until the application has been exited.
	err = app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}

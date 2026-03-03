package musicplayer

import (
	"log"
	"sync"

	application "github.com/wailsapp/wails/v3/pkg/application"
)

// WindowManager 管理音乐播放器窗口
type WindowManager struct {
	app         *application.App
	plugin      *MusicPlayerPlugin
	mu          sync.RWMutex
	musicWindow *application.WebviewWindow
	mainWindow  *application.WebviewWindow
	isVisible   bool
}

// NewWindowManager 创建窗口管理器
func NewWindowManager(plugin *MusicPlayerPlugin, app *application.App) *WindowManager {
	return &WindowManager{
		app:    app,
		plugin: plugin,
	}
}

// SetMainWindow 设置主窗口引用
func (wm *WindowManager) SetMainWindow(window *application.WebviewWindow) {
	wm.mu.Lock()
	defer wm.mu.Unlock()
	wm.mainWindow = window
}

// ServiceStartup 服务启动
func (wm *WindowManager) ServiceStartup(app *application.App) error {
	// 注册事件监听
	// TODO: 监听显示/隐藏窗口的事件
	return nil
}

// ServiceShutdown 服务关闭
func (wm *WindowManager) ServiceShutdown(app *application.App) error {
	wm.CloseWindow()
	return nil
}

// ShowWindow 显示音乐播放器窗口
func (wm *WindowManager) ShowWindow() error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	// 如果窗口已存在，直接显示
	if wm.musicWindow != nil {
		wm.musicWindow.Show()
		wm.musicWindow.Focus()
		wm.isVisible = true
		return nil
	}

	// 创建新的圆形窗口
	wm.musicWindow = wm.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:          "Music Player",
		Title:         "音乐播放器",
		Width:         420,
		Height:        600,
		Frameless:     true,
		AlwaysOnTop:   true,
		DisableResize: true,

		BackgroundType: application.BackgroundTypeTransparent,
		URL:            "/music-player",
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBar{
				Hide:            true,
				FullSizeContent: true,
				HideTitle:       true,
			},
			Backdrop:           application.MacBackdropTransparent,
			WindowLevel:        application.MacWindowLevelFloating,
			CollectionBehavior: application.MacWindowCollectionBehaviorCanJoinAllSpaces,
		},
	})

	// 居中显示（屏幕右下角）
	// TODO: 获取屏幕尺寸并计算居中位置
	wm.musicWindow.SetPosition(100, 100) // 临时位置

	// 显示窗口
	wm.musicWindow.Show()
	wm.musicWindow.Focus()
	wm.isVisible = true

	log.Printf("[MusicPlayer] Created music player window")

	return nil
}

// HideWindow 隐藏音乐播放器窗口
func (wm *WindowManager) HideWindow() error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if wm.musicWindow != nil {
		wm.musicWindow.Hide()
		wm.isVisible = false
	}

	return nil
}

// CloseWindow 关闭音乐播放器窗口
func (wm *WindowManager) CloseWindow() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if wm.musicWindow != nil {
		wm.musicWindow.Close()
		wm.musicWindow = nil
		wm.isVisible = false
		log.Printf("[MusicPlayer] Closed music player window")
	}
}

// ToggleWindow 切换窗口显示/隐藏
func (wm *WindowManager) ToggleWindow() error {
	wm.mu.RLock()
	isVisible := wm.isVisible
	wm.mu.RUnlock()

	if isVisible {
		return wm.HideWindow()
	} else {
		return wm.ShowWindow()
	}
}

// IsWindowVisible 窗口是否可见
func (wm *WindowManager) IsWindowVisible() bool {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.isVisible
}

// GetWindow 获取窗口实例
func (wm *WindowManager) GetWindow() *application.WebviewWindow {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.musicWindow
}

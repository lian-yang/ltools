//go:build windows

package clipboard

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
)

const (
	PluginID      = "clipboard.builtin"
	PluginName    = "剪贴板管理器"
	PluginVersion = "1.0.0"
)

// ClipboardItem represents an item in the clipboard history
type ClipboardItem struct {
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"` // text, image, etc.
}

// ClipboardPlugin provides clipboard management functionality (Windows stub)
type ClipboardPlugin struct {
	*plugins.BasePlugin
}

// NewClipboardPlugin creates a new clipboard plugin (Windows stub)
func NewClipboardPlugin() *ClipboardPlugin {
	metadata := &plugins.PluginMetadata{
		ID:          PluginID,
		Name:        PluginName,
		Version:     PluginVersion,
		Author:      "LTools Team",
		Description: "剪贴板历史记录管理器（Windows 上功能受限）",
		Icon:        "clipboard",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionClipboard,
		},
		Keywords: []string{"剪贴板", "复制", "粘贴", "clipboard", "copy", "paste"},
	}

	return &ClipboardPlugin{
		BasePlugin: plugins.NewBasePlugin(metadata),
	}
}

// Init initializes the plugin
func (p *ClipboardPlugin) Init(app *application.App) error {
	return p.BasePlugin.Init(app)
}

// ServiceStartup is called when the application starts
func (p *ClipboardPlugin) ServiceStartup(app *application.App) error {
	return p.BasePlugin.ServiceStartup(app)
}

// ServiceShutdown is called when the application shuts down
func (p *ClipboardPlugin) ServiceShutdown(app *application.App) error {
	return p.BasePlugin.ServiceShutdown(app)
}

// Enabled returns true if the plugin is enabled
func (p *ClipboardPlugin) Enabled() bool {
	return p.BasePlugin.Enabled()
}

// SetEnabled enables or disables the plugin
func (p *ClipboardPlugin) SetEnabled(enabled bool) error {
	return p.BasePlugin.SetEnabled(enabled)
}

// Stub implementations for Windows

func (p *ClipboardPlugin) GetHistory() []ClipboardItem {
	return []ClipboardItem{}
}

func (p *ClipboardPlugin) AddToHistory(content, itemType string) {
	// Not supported on Windows
}

func (p *ClipboardPlugin) ClearHistory() {
	// Not supported on Windows
}

func (p *ClipboardPlugin) GetLastItem() *ClipboardItem {
	return nil
}

func (p *ClipboardPlugin) SearchHistory(query string) []ClipboardItem {
	return []ClipboardItem{}
}

func (p *ClipboardPlugin) SetMaxHistory(max int) {
	// Not supported on Windows
}

func (p *ClipboardPlugin) GetMaxHistory() int {
	return 0
}

func (p *ClipboardPlugin) DeleteItem(index int) error {
	return nil
}

func (p *ClipboardPlugin) GetCurrentClipboard() string {
	return ""
}

func (p *ClipboardPlugin) GetImageFromClipboard() string {
	return ""
}

func (p *ClipboardPlugin) CopyImageToClipboard(base64Data string) error {
	return nil
}

func (p *ClipboardPlugin) SaveImageToFile(base64Data, defaultFilename string) (string, error) {
	return "", nil
}

func (p *ClipboardPlugin) GetClipboardContentType() string {
	return "unknown"
}

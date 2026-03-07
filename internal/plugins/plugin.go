package plugins

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// BoolPtr 返回 bool 的指针
func BoolPtr(b bool) *bool {
	return &b
}

// PluginType defines the type of plugin
type PluginType string

const (
	// PluginTypeBuiltIn is compiled into the main application
	PluginTypeBuiltIn PluginType = "builtin"
	// PluginTypeWeb is a dynamically loaded web component
	PluginTypeWeb PluginType = "web"
	// PluginTypeNative is a native plugin (future: WASM/RPC)
	PluginTypeNative PluginType = "native"
)

// PluginState represents the current state of a plugin
type PluginState string

const (
	PluginStateInstalled PluginState = "installed"
	PluginStateEnabled   PluginState = "enabled"
	PluginStateDisabled  PluginState = "disabled"
	PluginStateError     PluginState = "error"
)

// Permission represents a capability that a plugin may request
type Permission string

const (
	PermissionFileSystem  Permission = "filesystem"
	PermissionNetwork     Permission = "network"
	PermissionClipboard   Permission = "clipboard"
	PermissionNotification Permission = "notification"
	PermissionProcess     Permission = "process"
)

// PluginMetadata contains information about a plugin
type PluginMetadata struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Version     string       `json:"version"`
	Author      string       `json:"author"`
	Description string       `json:"description"`
	Icon        string       `json:"icon,omitempty"`
	Type        PluginType   `json:"type"`
	State       PluginState  `json:"state"`
	Permissions []Permission `json:"permissions,omitempty"`
	Keywords    []string     `json:"keywords,omitempty"` // For search
	Homepage    string       `json:"homepage,omitempty"`
	Repository  string       `json:"repository,omitempty"`
	License     string       `json:"license,omitempty"`
	// ShowInMenu 控制插件是否显示在侧边栏菜单中，默认 true
	// 使用指针类型以区分"未设置"（nil）和"显式设置为 false"（*false）
	ShowInMenu *bool `json:"showInMenu,omitempty"`
	// HasPage 控制插件是否有独立的页面视图，默认 true
	// 使用指针类型以区分"未设置"（nil）和"显式设置为 false"（*false）
	HasPage *bool `json:"hasPage,omitempty"`
	// 使用统计和智能排序字段
	UsageCount  int    `json:"usageCount,omitempty"`  // 累计访问次数
	LastUsedAt  string `json:"lastUsedAt,omitempty"`  // 最后访问时间（RFC3339）
	Pinned      *bool  `json:"pinned,omitempty"`      // 是否固定到顶部
	PinnedAt    string `json:"pinnedAt,omitempty"`    // 固定时间（RFC3339）
	Score       int    `json:"score,omitempty"`       // 加权使用分数（衰减算法）
}

// Plugin defines the interface that all plugins must implement
type Plugin interface {
	// Metadata returns the plugin's metadata
	Metadata() *PluginMetadata

	// Init is called when the plugin is first loaded
	// Use this for setup that doesn't require the app to be fully running
	Init(app *application.App) error

	// ServiceStartup is called when the application is starting up
	// This implements Wails v3's ServiceStartup interface
	ServiceStartup(app *application.App) error

	// ServiceShutdown is called when the application is shutting down
	// This implements Wails v3's ServiceShutdown interface
	ServiceShutdown(app *application.App) error

	// Enabled returns true if the plugin is currently enabled
	Enabled() bool

	// SetEnabled enables or disables the plugin
	SetEnabled(enabled bool) error
}

// ViewLifecycle defines optional methods for view-aware plugins
// Plugins can implement this interface to control resource usage based on view visibility
type ViewLifecycle interface {
	Plugin

	// OnViewEnter is called when user navigates to the plugin view
	OnViewEnter(app *application.App) error

	// OnViewLeave is called when user navigates away from the plugin view
	OnViewLeave(app *application.App) error
}

// BasePlugin provides a default implementation for common plugin functionality
// Other plugins can embed this struct to get default behavior
type BasePlugin struct {
	metadata *PluginMetadata
	enabled  bool
}

// NewBasePlugin creates a new BasePlugin with the given metadata
func NewBasePlugin(metadata *PluginMetadata) *BasePlugin {
	// Debug: print initial value
	fmt.Printf("[BasePlugin] Plugin %s: ShowInMenu initial value: %v (nil=%v)\n",
		metadata.ID, metadata.ShowInMenu, metadata.ShowInMenu == nil)

	// Set default values for optional pointer fields
	// 如果 ShowInMenu 为 nil（未设置），默认为 true
	if metadata.ShowInMenu == nil {
		trueValue := true
		metadata.ShowInMenu = &trueValue
		fmt.Printf("[BasePlugin] Plugin %s: ShowInMenu defaulted to true\n", metadata.ID)
	} else {
		// 保留显式设置的值（可能是 true 或 false）
		fmt.Printf("[BasePlugin] Plugin %s: ShowInMenu explicitly set to %v\n", metadata.ID, *metadata.ShowInMenu)
	}

	// 如果 HasPage 为 nil（未设置），默认为 true
	if metadata.HasPage == nil {
		trueValue := true
		metadata.HasPage = &trueValue
		fmt.Printf("[BasePlugin] Plugin %s: HasPage defaulted to true\n", metadata.ID)
	} else {
		// 保留显式设置的值（可能是 true 或 false）
		fmt.Printf("[BasePlugin] Plugin %s: HasPage explicitly set to %v\n", metadata.ID, *metadata.HasPage)
	}

	return &BasePlugin{
		metadata: metadata,
		enabled:  true, // Enabled by default
	}
}

// Metadata returns the plugin's metadata
func (b *BasePlugin) Metadata() *PluginMetadata {
	return b.metadata
}

// Init is called when the plugin is first loaded
func (b *BasePlugin) Init(app *application.App) error {
	return nil // Default: no-op
}

// ServiceStartup is called when the application is starting up
func (b *BasePlugin) ServiceStartup(app *application.App) error {
	return nil // Default: no-op
}

// ServiceShutdown is called when the application is shutting down
func (b *BasePlugin) ServiceShutdown(app *application.App) error {
	return nil // Default: no-op
}

// Enabled returns true if the plugin is currently enabled
func (b *BasePlugin) Enabled() bool {
	return b.enabled
}

// SetEnabled enables or disables the plugin
func (b *BasePlugin) SetEnabled(enabled bool) error {
	b.enabled = enabled
	return nil
}

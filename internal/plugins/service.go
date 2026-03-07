package plugins

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// PluginService exposes plugin management functionality to the frontend
type PluginService struct {
	app     *application.App
	manager *Manager
}

// NewPluginService creates a new plugin service
func NewPluginService(manager *Manager, app *application.App) *PluginService {
	return &PluginService{
		app:     app,
		manager: manager,
	}
}

// ServiceStartup is called when the application starts
func (s *PluginService) ServiceStartup(app *application.App) error {
	// Start all enabled plugins
	return s.manager.StartupAll()
}

// ServiceShutdown is called when the application shuts down
func (s *PluginService) ServiceShutdown(app *application.App) error {
	// Shutdown all enabled plugins
	return s.manager.ShutdownAll()
}

// List returns all plugins
func (s *PluginService) List() []*PluginMetadata {
	return s.manager.ListMetadata()
}

// Get returns a plugin by ID
func (s *PluginService) Get(id string) (*PluginMetadata, error) {
	plugin, ok := s.manager.Get(id)
	if !ok {
		return nil, ErrPluginNotFound
	}
	return plugin.Metadata(), nil
}

// Enable enables a plugin
func (s *PluginService) Enable(id string) error {
	return s.manager.Enable(id)
}

// Disable disables a plugin
func (s *PluginService) Disable(id string) error {
	return s.manager.Disable(id)
}

// Search searches for plugins by keyword
func (s *PluginService) Search(keywords ...string) []*PluginMetadata {
	return s.manager.registry.Search(keywords...)
}

// CheckPermission checks if a plugin has a specific permission
func (s *PluginService) CheckPermission(pluginID string, permission Permission) (bool, error) {
	return s.manager.CheckPermission(pluginID, permission)
}

// RequestPermission requests a permission for a plugin
func (s *PluginService) RequestPermission(pluginID string, permission Permission, granted bool) error {
	return s.manager.RequestPermission(pluginID, permission, granted)
}

// GetPermissions returns all permissions for a plugin
func (s *PluginService) GetPermissions(pluginID string) ([]Permission, error) {
	return s.manager.GetPermissions(pluginID)
}

// GetAvailablePermissions returns all available permission types
func (s *PluginService) GetAvailablePermissions() []Permission {
	return []Permission{
		PermissionFileSystem,
		PermissionNetwork,
		PermissionClipboard,
		PermissionNotification,
		PermissionProcess,
	}
}

// GetPluginTypes returns all available plugin types
func (s *PluginService) GetPluginTypes() []PluginType {
	return []PluginType{
		PluginTypeBuiltIn,
		PluginTypeWeb,
		PluginTypeNative,
	}
}

// GetPluginStates returns all available plugin states
func (s *PluginService) GetPluginStates() []PluginState {
	return []PluginState{
		PluginStateInstalled,
		PluginStateEnabled,
		PluginStateDisabled,
		PluginStateError,
	}
}

// FormatPluginMetadata formats a plugin's metadata for display
func (s *PluginService) FormatPluginMetadata(id string) (map[string]interface{}, error) {
	plugin, ok := s.manager.Get(id)
	if !ok {
		return nil, ErrPluginNotFound
	}

	metadata := plugin.Metadata()
	return map[string]interface{}{
		"id":          metadata.ID,
		"name":        metadata.Name,
		"version":     metadata.Version,
		"author":      metadata.Author,
		"description": metadata.Description,
		"icon":        metadata.Icon,
		"type":        string(metadata.Type),
		"state":       string(metadata.State),
		"permissions": metadata.Permissions,
		"keywords":    metadata.Keywords,
		"homepage":    metadata.Homepage,
		"repository":  metadata.Repository,
		"license":     metadata.License,
		"enabled":     plugin.Enabled(),
	}, nil
}

// GetPluginMethods returns the available methods for a plugin
// This is a placeholder for future implementation where plugins can expose their methods
func (s *PluginService) GetPluginMethods(id string) ([]string, error) {
	plugin, ok := s.manager.Get(id)
	if !ok {
		return nil, ErrPluginNotFound
	}

	// For now, return a generic message
	// In the future, this could use reflection to get actual methods
	return []string{
		fmt.Sprintf("%s methods", plugin.Metadata().Name),
	}, nil
}

// RecordUsage 记录插件使用（供前端调用）
func (s *PluginService) RecordUsage(id string) error {
	return s.manager.registry.RecordUsage(id)
}

// TogglePin 切换插件固定状态（供前端调用）
func (s *PluginService) TogglePin(id string) (bool, error) {
	return s.manager.registry.TogglePin(id)
}

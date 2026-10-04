package plugins

import (
	"errors"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Manager manages all plugins in the system
type Manager struct {
	app       *application.App
	registry  *Registry
	plugins   map[string]Plugin
	permMgr   *PermissionManager
	mu        sync.RWMutex
}

// NewManager creates a new plugin manager
func NewManager(app *application.App, dataDir string) (*Manager, error) {
	registry, err := NewRegistry(dataDir)
	if err != nil {
		return nil, fmt.Errorf("failed to create registry: %w", err)
	}

	return &Manager{
		app:      app,
		registry: registry,
		plugins:  make(map[string]Plugin),
		permMgr:  NewPermissionManager(),
	}, nil
}

// Register registers a plugin with the manager
func (m *Manager) Register(plugin Plugin) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	metadata := plugin.Metadata()

	// Check if plugin already exists
	if _, exists := m.plugins[metadata.ID]; exists {
		return ErrPluginExists
	}

	// Initialize the plugin
	if err := plugin.Init(m.app); err != nil {
		return fmt.Errorf("failed to initialize plugin %s: %w", metadata.ID, err)
	}

	// Add to registry - this will preserve the existing state if plugin was already registered
	if err := m.registry.Register(metadata); err != nil {
		return fmt.Errorf("failed to register plugin %s: %w", metadata.ID, err)
	}

	// Synchronize plugin enabled state with metadata state
	// After Register, metadata.State reflects the saved state
	// installed 视为默认启用，与 StartupAll 的 installed->enabled 语义一致
	shouldBeEnabled := metadata.State == PluginStateEnabled || metadata.State == PluginStateInstalled
	currentlyEnabled := plugin.Enabled()

	if shouldBeEnabled != currentlyEnabled {
		fmt.Printf("[Manager] Syncing plugin %s enabled state: metadata.State=%s, plugin.Enabled()=%v, setting to %v\n",
			metadata.ID, metadata.State, currentlyEnabled, shouldBeEnabled)
		plugin.SetEnabled(shouldBeEnabled)
	}

	// Store the plugin
	m.plugins[metadata.ID] = plugin

	return nil
}

// Unregister unregisters a plugin from the manager
func (m *Manager) Unregister(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	plugin, exists := m.plugins[id]
	if !exists {
		return ErrPluginNotFound
	}

	// Shutdown the plugin if it's enabled
	if plugin.Enabled() {
		if err := plugin.ServiceShutdown(m.app); err != nil {
			return fmt.Errorf("failed to shutdown plugin %s: %w", id, err)
		}
	}

	// Remove from registry
	if err := m.registry.Unregister(id); err != nil {
		return fmt.Errorf("failed to unregister plugin %s: %w", id, err)
	}

	// Remove from plugins map
	delete(m.plugins, id)

	return nil
}

// Enable enables a plugin
func (m *Manager) Enable(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	plugin, exists := m.plugins[id]
	if !exists {
		return ErrPluginNotFound
	}

	if plugin.Enabled() {
		return nil // Already enabled
	}

	// Start the plugin
	if err := plugin.ServiceStartup(m.app); err != nil {
		return fmt.Errorf("failed to start plugin %s: %w", id, err)
	}

	// Update enabled state
	if err := plugin.SetEnabled(true); err != nil {
		return fmt.Errorf("failed to enable plugin %s: %w", id, err)
	}

	// Update registry - get the metadata pointer and update it directly
	metadata := plugin.Metadata()
	// Update the state
	metadata.State = PluginStateEnabled
	// Now update the registry with the same pointer
	if err := m.registry.Update(metadata); err != nil {
		return fmt.Errorf("failed to update registry: %w", err)
	}

	// DEBUG: Log the state change
	fmt.Printf("[Plugin Manager] Enabled plugin %s, state = %s\n", id, metadata.State)

	return nil
}

// Disable disables a plugin
func (m *Manager) Disable(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	plugin, exists := m.plugins[id]
	if !exists {
		return ErrPluginNotFound
	}

	if !plugin.Enabled() {
		return nil // Already disabled
	}

	// Shutdown the plugin
	if err := plugin.ServiceShutdown(m.app); err != nil {
		return fmt.Errorf("failed to shutdown plugin %s: %w", id, err)
	}

	// Update enabled state
	if err := plugin.SetEnabled(false); err != nil {
		return fmt.Errorf("failed to disable plugin %s: %w", id, err)
	}

	// Update registry
	metadata := plugin.Metadata()
	metadata.State = PluginStateDisabled
	if err := m.registry.Update(metadata); err != nil {
		return fmt.Errorf("failed to update registry: %w", err)
	}

	return nil
}

// Get retrieves a plugin by ID
func (m *Manager) Get(id string) (Plugin, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugin, ok := m.plugins[id]
	return plugin, ok
}

// List returns all registered plugins
func (m *Manager) List() []Plugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]Plugin, 0, len(m.plugins))
	for _, plugin := range m.plugins {
		result = append(result, plugin)
	}

	return result
}

// ListMetadata returns all plugin metadata
func (m *Manager) ListMetadata() []*PluginMetadata {
	return m.registry.List()
}

// ListByType returns plugins of a specific type
func (m *Manager) ListByType(pluginType PluginType) []Plugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []Plugin
	for _, plugin := range m.plugins {
		if plugin.Metadata().Type == pluginType {
			result = append(result, plugin)
		}
	}

	return result
}

// ListByState returns plugins in a specific state
func (m *Manager) ListByState(state PluginState) []Plugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []Plugin
	for _, plugin := range m.plugins {
		if plugin.Metadata().State == state {
			result = append(result, plugin)
		}
	}

	return result
}

// Search finds plugins matching the given keywords
func (m *Manager) Search(keywords ...string) []Plugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metadataList := m.registry.Search(keywords...)

	result := make([]Plugin, 0, len(metadataList))
	for _, metadata := range metadataList {
		if plugin, ok := m.plugins[metadata.ID]; ok {
			result = append(result, plugin)
		}
	}

	return result
}

// CheckPermission checks if a plugin has a specific permission
func (m *Manager) CheckPermission(pluginID string, permission Permission) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugin, exists := m.plugins[pluginID]
	if !exists {
		return false, ErrPluginNotFound
	}

	// Check if plugin has requested this permission
	metadata := plugin.Metadata()
	hasRequested := false
	for _, p := range metadata.Permissions {
		if p == permission {
			hasRequested = true
			break
		}
	}

	if !hasRequested {
		return false, nil
	}

	// Check if permission has been granted
	return m.permMgr.IsGranted(pluginID, permission), nil
}

// RequestPermission requests a permission for a plugin
// This should be called from the frontend after user approval
func (m *Manager) RequestPermission(pluginID string, permission Permission, granted bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.plugins[pluginID]; !exists {
		return ErrPluginNotFound
	}

	if granted {
		m.permMgr.Grant(pluginID, permission)
	} else {
		m.permMgr.Revoke(pluginID, permission)
	}

	return nil
}

// GetPermissions returns all permissions for a plugin
func (m *Manager) GetPermissions(pluginID string) ([]Permission, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugin, exists := m.plugins[pluginID]
	if !exists {
		return nil, ErrPluginNotFound
	}

	return plugin.Metadata().Permissions, nil
}

// StartupAll starts all enabled plugins
func (m *Manager) StartupAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var errs []error

	for _, plugin := range m.plugins {
		metadata := plugin.Metadata()
		if metadata.State == PluginStateEnabled || metadata.State == PluginStateInstalled {
			if err := plugin.ServiceStartup(m.app); err != nil {
				errs = append(errs, fmt.Errorf("failed to start plugin %s: %w", metadata.ID, err))
				// Update state to error
				metadata.State = PluginStateError
				m.registry.Update(metadata)
			} else {
				metadata.State = PluginStateEnabled
				m.registry.Update(metadata)
			}
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

// ShutdownAll shuts down all enabled plugins
func (m *Manager) ShutdownAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var errs []error

	for _, plugin := range m.plugins {
		if plugin.Enabled() {
			if err := plugin.ServiceShutdown(m.app); err != nil {
				errs = append(errs, fmt.Errorf("failed to shutdown plugin %s: %w", plugin.Metadata().ID, err))
			}
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

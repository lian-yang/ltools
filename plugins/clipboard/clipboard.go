//go:build !windows

package clipboard

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
)

var debugLog *os.File

func init() {
	// Initialize debug log file in project directory
	f, err := os.OpenFile("/Users/yanglian/code/ltools/clipboard-debug.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		debugLog = f
		log.SetOutput(f)
		fmt.Println("[Clipboard Plugin] Debug log initialized: /Users/yanglian/code/ltools/clipboard-debug.log")
		debugWrite("Debug log initialized")
	} else {
		fmt.Println("[Clipboard Plugin] Failed to initialize debug log:", err)
	}
}

// debugWrite writes a message to the debug log file
func debugWrite(format string, args ...interface{}) {
	if debugLog != nil {
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		msg := fmt.Sprintf("[%s] %s\n", timestamp, fmt.Sprintf(format, args...))
		debugLog.WriteString(msg)
	}
}

const (
	PluginID      = "clipboard.builtin"
	PluginName    = "剪贴板管理器"
	PluginVersion = "1.0.0"
)

// ClipboardItem represents an item in the clipboard history
type ClipboardItem struct {
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"` // text, image, etc.
}

// ClipboardPlugin provides clipboard management functionality
type ClipboardPlugin struct {
	*plugins.BasePlugin
	app           *application.App
	history       []ClipboardItem
	maxHistory    int
	lastClipboard string         // Track last clipboard content to detect changes
	stopMonitoring chan struct{} // Channel to stop monitoring
}

// NewClipboardPlugin creates a new clipboard plugin
func NewClipboardPlugin() *ClipboardPlugin {
	metadata := &plugins.PluginMetadata{
		ID:          PluginID,
		Name:        PluginName,
		Version:     PluginVersion,
		Author:      "LTools Team",
		Description: "剪贴板历史记录管理器，自动保存复制的内容",
		Icon:        "clipboard",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionClipboard,
		},
		Keywords: []string{"剪贴板", "复制", "粘贴", "clipboard", "copy", "paste"},
	}

	base := plugins.NewBasePlugin(metadata)
	return &ClipboardPlugin{
		BasePlugin:      base,
		history:         make([]ClipboardItem, 0),
		maxHistory:      100, // Keep last 100 items
		stopMonitoring:  make(chan struct{}),
	}
}

// Init initializes the plugin
func (p *ClipboardPlugin) Init(app *application.App) error {
	if err := p.BasePlugin.Init(app); err != nil {
		return err
	}
	p.app = app
	return nil
}

// ServiceStartup is called when the application starts
func (p *ClipboardPlugin) ServiceStartup(app *application.App) error {
	log.Printf("[Clipboard Plugin] ServiceStartup called\n")
	if err := p.BasePlugin.ServiceStartup(app); err != nil {
		log.Printf("[Clipboard Plugin] ServiceStartup BasePlugin error: %v\n", err)
		return err
	}
	p.app = app

	// Request clipboard permission
	p.emitEvent("permission:requested", "clipboard")

	// Start clipboard monitoring
	log.Printf("[Clipboard Plugin] Starting clipboard monitoring...\n")
	fmt.Println("[Clipboard Plugin] Starting clipboard monitoring...")
	go p.monitorClipboard()

	return nil
}

// ServiceShutdown is called when the application shuts down
func (p *ClipboardPlugin) ServiceShutdown(app *application.App) error {
	// Stop monitoring
	close(p.stopMonitoring)
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

// Helper method to emit events
func (p *ClipboardPlugin) emitEvent(eventName, data string) {
	if p.app != nil {
		p.app.Event.Emit("clipboard:"+eventName, data)
	}
}

// monitorClipboard monitors the clipboard for changes
func (p *ClipboardPlugin) monitorClipboard() {
	ticker := time.NewTicker(500 * time.Millisecond) // Check every 500ms
	defer ticker.Stop()

	fmt.Println("[Clipboard Plugin] Monitor started, checking every 500ms")

	for {
		select {
		case <-p.stopMonitoring:
			fmt.Println("[Clipboard Plugin] Monitor stopped")
			return
		case <-ticker.C:
			// Check both plugin enabled state and metadata state
			enabled := p.Enabled()
			metadataState := p.Metadata().State
			stateEnabled := plugins.PluginStateEnabled
			shouldMonitor := enabled || metadataState == stateEnabled

			// Debug logging
			log.Printf("[Clipboard Plugin] Debug: enabled=%v, state=%q, stateEnabled=%q, shouldMonitor=%v\n",
				enabled, metadataState, stateEnabled, shouldMonitor)

			if shouldMonitor {
				// Check for image first
				imageData := p.getClipboardImage()
				if imageData != "" {
					// Image found in clipboard
					if imageData != p.lastClipboard {
						log.Printf("[Clipboard Plugin] Clipboard image changed! Length: %d\n", len(imageData))
						p.lastClipboard = imageData
						p.AddToHistory(imageData, "image")
					}
				} else {
					// No image, check for text
					currentClipboard := p.getSystemClipboard()
					if currentClipboard != "" && currentClipboard != p.lastClipboard {
						// Clipboard has changed
						log.Printf("[Clipboard Plugin] Clipboard changed! New content length: %d\n", len(currentClipboard))
						p.lastClipboard = currentClipboard
						p.AddToHistory(currentClipboard, "text")
					}
				}
			}
		}
	}
}

// getSystemClipboard gets the current system clipboard content
func (p *ClipboardPlugin) getSystemClipboard() string {
	// Use osascript to get clipboard on macOS
	cmd := exec.Command("osascript", "-e", "get the clipboard")
	output, err := cmd.Output()
	if err != nil {
		// Silently fail - clipboard might be empty or not accessible
		return ""
	}
	content := strings.TrimSpace(string(output))
	// Debug: Log clipboard content (truncated)
	// if len(content) > 0 {
	// 	fmt.Printf("[Clipboard Plugin] Read clipboard: %q (%d chars)\n",
	// 		truncateString(content, 50), len(content))
	// }
	return content
}

// getClipboardImage gets image from clipboard as base64 data URL
func (p *ClipboardPlugin) getClipboardImage() string {
	// Check if clipboard contains image
	cmd := exec.Command("osascript", "-e", "clipboard info")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}

	info := string(output)
	// Check if clipboard contains image types
	if !strings.Contains(info, "TIFF") && !strings.Contains(info, "PNG") && !strings.Contains(info, "JPEG") {
		return ""
	}

	// Try to save clipboard image to a temp file and convert to base64
	tmpFile := "/tmp/ltools_clipboard_image.png"

	// Use osascript to save clipboard image as PNG
	script := fmt.Sprintf(`
		tell application "System Events"
			try
				set theData to the clipboard as «class PNGf»
				set theFile to open for access POSIX file "%s" with write permission
				set eof of theFile to 0
				write theData to theFile
				close access theFile
			on error
				try
					close access POSIX file "%s"
				end try
				return ""
			end try
		end tell
	`, tmpFile, tmpFile)

	cmd = exec.Command("osascript", "-e", script)
	_, err = cmd.Output()
	if err != nil {
		debugWrite("Failed to save clipboard image: %v", err)
		return ""
	}

	// Read the file and convert to base64
	imageData, err := os.ReadFile(tmpFile)
	if err != nil {
		debugWrite("Failed to read temp image file: %v", err)
		return ""
	}

	// Clean up temp file
	defer os.Remove(tmpFile)

	// Convert to base64 data URL
	base64Data := "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageData)
	debugWrite("Got clipboard image, length: %d", len(base64Data))

	return base64Data
}

// Helper function to truncate string for logging
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// GetCurrentClipboard returns the current system clipboard content
func (p *ClipboardPlugin) GetCurrentClipboard() string {
	return p.getSystemClipboard()
}

// GetHistory returns the clipboard history
func (p *ClipboardPlugin) GetHistory() []ClipboardItem {
	return p.history
}

// AddToHistory adds an item to the clipboard history
func (p *ClipboardPlugin) AddToHistory(content, itemType string) {
	log.Printf("[Clipboard Plugin] AddToHistory called with content length: %d, type: %s\n", len(content), itemType)

	item := ClipboardItem{
		Content:   content,
		Timestamp: time.Now(),
		Type:      itemType,
	}

	// Add to history
	p.history = append([]ClipboardItem{item}, p.history...)

	// Trim if exceeds max history
	if len(p.history) > p.maxHistory {
		p.history = p.history[:p.maxHistory]
	}

	// Emit event
	log.Printf("[Clipboard Plugin] Added to history: %q (total: %d items)\n", truncateString(content, 50), len(p.history))
	p.emitEvent("new", content)
	p.emitEvent("count", fmt.Sprintf("%d", len(p.history)))
}

// ClearHistory clears all clipboard history
func (p *ClipboardPlugin) ClearHistory() {
	log.Printf("[Clipboard Plugin] ClearHistory called, current history size: %d\n", len(p.history))
	p.history = make([]ClipboardItem, 0)
	log.Printf("[Clipboard Plugin] History cleared, new size: %d\n", len(p.history))
	p.emitEvent("cleared", "")
	p.emitEvent("count", "0")
}

// GetLastItem returns the most recent clipboard item
func (p *ClipboardPlugin) GetLastItem() *ClipboardItem {
	if len(p.history) == 0 {
		return nil
	}
	return &p.history[0]
}

// SearchHistory searches clipboard history by content
func (p *ClipboardPlugin) SearchHistory(query string) []ClipboardItem {
	var results []ClipboardItem

	for _, item := range p.history {
		if contains(item.Content, query) {
			results = append(results, item)
		}
	}

	return results
}

// SetMaxHistory sets the maximum number of history items to keep
func (p *ClipboardPlugin) SetMaxHistory(max int) {
	p.maxHistory = max

	// Trim existing history if needed
	if len(p.history) > max {
		p.history = p.history[:max]
		p.emitEvent("count", fmt.Sprintf("%d", len(p.history)))
	}
}

// GetMaxHistory returns the maximum number of history items
func (p *ClipboardPlugin) GetMaxHistory() int {
	return p.maxHistory
}

// DeleteItem removes an item from history by index
func (p *ClipboardPlugin) DeleteItem(index int) error {
	if index < 0 || index >= len(p.history) {
		return fmt.Errorf("index out of bounds")
	}

	p.history = append(p.history[:index], p.history[index+1:]...)
	p.emitEvent("deleted", fmt.Sprintf("%d", index))
	p.emitEvent("count", fmt.Sprintf("%d", len(p.history)))
	return nil
}

// Helper function to check if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
		 len(s) > len(substr) && (s[0:len(substr)] == substr ||
			s[len(s)-len(substr):] == substr ||
			containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// GetImageFromClipboard returns the current image from clipboard as base64
func (p *ClipboardPlugin) GetImageFromClipboard() string {
	// This functionality requires platform-specific implementation
	// For now, return empty string as image clipboard is handled separately
	return ""
}

// CopyImageToClipboard copies a base64 encoded image to the clipboard
func (p *ClipboardPlugin) CopyImageToClipboard(base64Data string) error {
	// This functionality requires platform-specific implementation
	// For now, return nil as image clipboard is handled separately
	return nil
}

// SaveImageToFile saves a base64 encoded image to a file
func (p *ClipboardPlugin) SaveImageToFile(base64Data, defaultFilename string) (string, error) {
	// This functionality requires platform-specific implementation
	// For now, return empty string and nil as image saving is handled separately
	return "", nil
}

// GetClipboardContentType returns the type of content in the clipboard
func (p *ClipboardPlugin) GetClipboardContentType() string {
	// Check if there's text in clipboard
	currentClipboard := p.getSystemClipboard()
	if currentClipboard != "" {
		return "text"
	}
	// Could check for image here in the future
	return "unknown"
}

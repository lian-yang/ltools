//go:build windows
package clipboard
import (
	"ltools/internal/plugins/clipboard"
)
// ImageClipboard is a stub implementation for Windows
// It provides a cross-platform image clipboard operations
type ImageClipboard struct {
	clipboard *clipboardpkg.ImageClipboard
}

// NewImageClipboard creates a new clipboard instance
func NewImageClipboard() *ImageClipboard {
	return &ImageClipboard{clipboard: clipboardpkg.ImageClipboard}
}


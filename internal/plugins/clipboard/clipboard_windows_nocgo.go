//go:build windows && !cgo

package clipboard

import (
	"image"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ImageClipboard handles clipboard operations for images (Windows stub without CGO)
type ImageClipboard struct {
	app *application.App
}

// NewImageClipboard creates a new clipboard instance (Windows stub)
func NewImageClipboard(app *application.App) *ImageClipboard {
	return &ImageClipboard{app: app}
}

// SetImageFromRGBA sets an image to the clipboard from RGBA format (Windows stub)
func (c *ImageClipboard) SetImageFromRGBA(img *image.RGBA) error {
	return &UnsupportedPlatformError{Platform: "windows (CGO disabled)"}
}

// SetImage sets an image to the clipboard (Windows stub)
func (c *ImageClipboard) SetImage(imgData []byte) error {
	return &UnsupportedPlatformError{Platform: "windows (CGO disabled)"}
}

// GetImage gets an image from the clipboard (Windows stub)
func (c *ImageClipboard) GetImage() ([]byte, error) {
	return nil, &UnsupportedPlatformError{Platform: "windows (CGO disabled)"}
}

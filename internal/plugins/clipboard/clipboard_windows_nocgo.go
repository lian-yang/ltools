//go:build windows && !cgo

package clipboard

import (
	"fmt"
	"image"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ImageClipboard handles clipboard operations for images (Windows stub without CGO)
type ImageClipboard struct {
	app *application.App
}

// NewImageClipboard creates a new clipboard instance (Windows stub without CGO)
func NewImageClipboard(app *application.App) *ImageClipboard {
	return &ImageClipboard{app: app}
}

// SetImageFromRGBA sets an image to the clipboard from RGBA format (Windows stub without CGO)
func (c *ImageClipboard) SetImageFromRGBA(img *image.RGBA) error {
	return fmt.Errorf("clipboard: SetImageFromRGBA not supported on Windows without CGO")
}

// SetImage sets an image to the clipboard (Windows stub without CGO)
func (c *ImageClipboard) SetImage(imgData []byte) error {
	return fmt.Errorf("clipboard: SetImage not supported on Windows without CGO")
}

// GetImage gets an image from the clipboard (Windows stub without CGO)
func (c *ImageClipboard) GetImage() ([]byte, error) {
	return nil, fmt.Errorf("clipboard: GetImage not supported on Windows without CGO")
}

package imageprocessor

import (
	"errors"
	"fmt"
	"image"
	"strings"
)

func calculateCropRect(img image.Image, opts *CropOptions) (image.Rectangle, error) {
	if img == nil {
		return image.Rectangle{}, errors.New("无效图片")
	}

	bounds := img.Bounds()
	imgW := bounds.Dx()
	imgH := bounds.Dy()

	x := opts.X
	y := opts.Y
	width := opts.Width
	height := opts.Height

	if opts.AspectRatio != "" && width == 0 && height == 0 {
		parts := strings.Split(opts.AspectRatio, ":")
		if len(parts) == 2 {
			var w, h int
			fmt.Sscanf(parts[0], "%d", &w)
			fmt.Sscanf(parts[1], "%d", &h)
			if w > 0 && h > 0 {
				imgRatio := float64(imgW) / float64(imgH)
				targetRatio := float64(w) / float64(h)

				if imgRatio > targetRatio {
					width = int(float64(imgH) * targetRatio)
					height = imgH
					x = (imgW - width) / 2
					y = 0
				} else {
					width = imgW
					height = int(float64(imgW) / targetRatio)
					x = 0
					y = (imgH - height) / 2
				}
			}
		}
	}

	if width <= 0 || height <= 0 {
		return image.Rectangle{}, errors.New("裁剪尺寸无效")
	}

	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	if x >= imgW || y >= imgH {
		return image.Rectangle{}, errors.New("裁剪区域超出图片范围")
	}
	if x+width > imgW {
		width = imgW - x
	}
	if y+height > imgH {
		height = imgH - y
	}
	if width <= 0 || height <= 0 {
		return image.Rectangle{}, errors.New("裁剪尺寸无效")
	}

	return image.Rect(x, y, x+width, y+height), nil
}

package imageprocessor

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/kirklin/go-blind-watermark/bwm"
)

// fixedTextLen is the fixed length for text watermarks (in characters)
// Each character = 8 bits, so 256 chars = 2048 bits
const fixedTextLen = 256

// EncodeBlindWatermark embeds a blind watermark into an image
func (p *ImageProcessor) EncodeBlindWatermark(inputPath string, opts *SteganographyOptions) (string, error) {
	// Load base image
	baseImg, err := imaging.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("加载图片失败: %w", err)
	}

	// Set default passwords
	password1 := opts.Password1
	if password1 == 0 {
		password1 = 12345
	}
	password2 := opts.Password2
	if password2 == 0 {
		password2 = 67890
	}

	// Create blind watermark engine
	// Seed1: Image shuffle, Seed2: Watermark encryption
	engine := bwm.New(int64(password1), int64(password2))
	engine.D1 = 36.0 // Strength factor (larger = more robust but lower quality)

	var watermarkedImg image.Image

	if opts.Type == "text" || opts.Type == "" {
		// Text watermark
		if strings.TrimSpace(opts.Message) == "" {
			return "", errors.New("水印文本不能为空")
		}

		// Pad text to fixed length for reliable extraction
		text := opts.Message
		if len(text) > fixedTextLen {
			text = text[:fixedTextLen]
		}
		// Pad with spaces to fixed length
		for len(text) < fixedTextLen {
			text += " "
		}

		// Convert text to bits
		wmBits := bwm.TextToBits(text)

		// Embed watermark
		watermarkedImg, err = engine.Embed(baseImg, wmBits)
		if err != nil {
			return "", fmt.Errorf("嵌入文本水印失败: %w", err)
		}
	} else if opts.Type == "image" {
		// Image watermark
		if opts.ImagePath == "" {
			return "", errors.New("水印图片路径不能为空")
		}

		// Load watermark image
		var wmImg image.Image
		if strings.HasPrefix(opts.ImagePath, "data:") {
			// Data URL
			data, err := decodeDataURL(opts.ImagePath)
			if err != nil {
				return "", fmt.Errorf("解析水印图片失败: %w", err)
			}
			wmImg, err = imaging.Decode(bytes.NewReader(data))
			if err != nil {
				return "", fmt.Errorf("解码水印图片失败: %w", err)
			}
		} else {
			// File path
			wmImg, err = imaging.Open(opts.ImagePath)
			if err != nil {
				return "", fmt.Errorf("加载水印图片失败: %w", err)
			}
		}

		// Resize logo to fit capacity (64x64 is recommended)
		resizedLogo := bwm.ResizeImage(wmImg, 64, 64)

		// Convert logo to bits (threshold 128)
		wmBits, w, h := bwm.LogoToBits(resizedLogo, 128)
		_ = w
		_ = h

		// Embed watermark
		watermarkedImg, err = engine.Embed(baseImg, wmBits)
		if err != nil {
			return "", fmt.Errorf("嵌入图片水印失败: %w", err)
		}
	} else {
		return "", errors.New("不支持的水印类型")
	}

	// Get output path
	outputPath, err := p.getOutputPath(inputPath, "png") // Must save as PNG for lossless
	if err != nil {
		return "", err
	}

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return "", fmt.Errorf("创建输出目录失败: %w", err)
	}

	// Save as PNG
	file, err := os.Create(outputPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	if err := png.Encode(file, watermarkedImg); err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	return outputPath, nil
}

// DecodeBlindWatermark extracts a blind watermark from an image
func (p *ImageProcessor) DecodeBlindWatermark(inputPath string, opts *SteganographyOptions) (string, error) {
	// Load image
	file, err := os.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", fmt.Errorf("解码图片失败: %w", err)
	}

	// Set default passwords (must match the ones used for embedding)
	password1 := opts.Password1
	if password1 == 0 {
		password1 = 12345
	}
	password2 := opts.Password2
	if password2 == 0 {
		password2 = 67890
	}

	// Create blind watermark engine with same seeds and D1 strength
	engine := bwm.New(int64(password1), int64(password2))
	engine.D1 = 36.0 // Must match the D1 used during encoding!

	if opts.Type == "text" || opts.Type == "" {
		// Extract text watermark
		// Use the same fixed length as encoding (256 chars = 2048 bits)
		extractLen := fixedTextLen * 8

		bits, err := engine.Extract(img, extractLen)
		if err != nil {
			return "", fmt.Errorf("提取文本水印失败: %w", err)
		}

		text := bwm.BitsToText(bits)
		result := strings.TrimSpace(text)
		if result == "" {
			return "", errors.New("未检测到有效水印信息，请确认密码种子正确")
		}
		return result, nil
	} else if opts.Type == "image" {
		// Extract image watermark
		// Default to 64x64 as used in encoding
		w, h := 64, 64
		bits, err := engine.Extract(img, w*h)
		if err != nil {
			return "", fmt.Errorf("提取图片水印失败: %w", err)
		}

		extractedImg := bwm.BitsToLogo(bits, w, h)

		// Save extracted watermark image
		outputPath, err := p.getOutputPath(inputPath, "png")
		if err != nil {
			return "", err
		}

		// Ensure output directory exists
		if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
			return "", fmt.Errorf("创建输出目录失败: %w", err)
		}

		// Save extracted watermark
		outputFile, err := os.Create(outputPath)
		if err != nil {
			return "", fmt.Errorf("创建文件失败: %w", err)
		}
		defer outputFile.Close()

		if err := png.Encode(outputFile, extractedImg); err != nil {
			return "", fmt.Errorf("保存提取的水印失败: %w", err)
		}

		return fmt.Sprintf("水印已提取并保存到: %s", outputPath), nil
	}

	return "", errors.New("不支持的水印类型")
}

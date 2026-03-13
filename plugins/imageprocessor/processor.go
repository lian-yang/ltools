package imageprocessor

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/disintegration/imaging"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// ImageProcessor handles image processing operations
type ImageProcessor struct {
	mu sync.Mutex
}

// NewImageProcessor creates a new image processor
func NewImageProcessor() *ImageProcessor {
	return &ImageProcessor{}
}

// GetImageInfo loads and returns image metadata
func (p *ImageProcessor) GetImageInfo(filePath string) (*ImageFile, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	// Get file info
	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("读取文件信息失败: %w", err)
	}

	// Decode image config (doesn't load full image)
	img, format, err := image.DecodeConfig(file)
	if err != nil {
		return nil, fmt.Errorf("解码图片失败: %w", err)
	}

	// Detect format
	ext := strings.ToLower(filepath.Ext(filePath))
	if format == "" {
		format = strings.TrimPrefix(ext, ".")
	}

	return &ImageFile{
		Path:     filePath,
		Name:     filepath.Base(filePath),
		Size:     stat.Size(),
		Width:    img.Width,
		Height:   img.Height,
		Format:   format,
		Modified: stat.ModTime().Unix(),
	}, nil
}

// CompressImage compresses an image according to options
func (p *ImageProcessor) CompressImage(inputPath string, opts *CompressOptions) (string, error) {
	// Load image
	img, err := imaging.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("加载图片失败: %w", err)
	}

	// Resize if max dimensions specified
	if opts.MaxWidth > 0 || opts.MaxHeight > 0 {
		img = imaging.Resize(img, opts.MaxWidth, opts.MaxHeight, imaging.Lanczos)
	}

	// Get output path
	outputPath, err := p.getOutputPath(inputPath, opts.OutputFormat)
	if err != nil {
		return "", err
	}

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return "", fmt.Errorf("创建输出目录失败: %w", err)
	}

	// Determine output format
	format := opts.OutputFormat
	if format == "" {
		format = strings.TrimPrefix(strings.ToLower(filepath.Ext(inputPath)), ".")
	}

	// Save with quality
	switch format {
	case "jpeg", "jpg":
		err = imaging.Save(img, outputPath, imaging.JPEGQuality(opts.Quality))
	case "png":
		// PNG doesn't have quality parameter, but we can convert
		err = imaging.Save(img, outputPath)
	case "webp":
		// WebP support requires additional library
		return "", errors.New("WebP 格式暂不支持")
	default:
		err = imaging.Save(img, outputPath)
	}

	if err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	return outputPath, nil
}

// CropImage crops an image according to options
func (p *ImageProcessor) CropImage(inputPath string, opts *CropOptions) (string, error) {
	// Load image
	img, err := imaging.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("加载图片失败: %w", err)
	}

	// Crop image
	rect, err := calculateCropRect(img, opts)
	if err != nil {
		return "", err
	}
	cropped := imaging.Crop(img, rect)

	// Get output path
	outputPath, err := p.getOutputPath(inputPath, "")
	if err != nil {
		return "", err
	}

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return "", fmt.Errorf("创建输出目录失败: %w", err)
	}

	// Save
	if err := imaging.Save(cropped, outputPath); err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	return outputPath, nil
}

// AddWatermark adds watermark to an image
func (p *ImageProcessor) AddWatermark(inputPath string, opts *WatermarkOptions) (string, error) {
	// Load base image
	baseImg, err := imaging.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("加载图片失败: %w", err)
	}

	var watermark image.Image

	if opts.Type == "text" {
		watermark, err = buildTextWatermark(opts)
		if err != nil {
			return "", err
		}
	} else if opts.Type == "image" {
		// Load watermark image
		watermark, err = loadWatermarkImage(opts.ImagePath)
		if err != nil {
			return "", fmt.Errorf("加载水印图片失败: %w", err)
		}

		// Scale watermark if needed
		if opts.Scale > 0 && opts.Scale != 1 {
			bounds := watermark.Bounds()
			newW := int(float64(bounds.Dx()) * opts.Scale)
			newH := int(float64(bounds.Dy()) * opts.Scale)
			watermark = imaging.Resize(watermark, newW, newH, imaging.Lanczos)
		}
	} else {
		return "", errors.New("不支持的水印类型")
	}

	// Create output image
	result := imaging.Clone(baseImg)

	// Calculate position
	bounds := result.Bounds()
	wmBounds := watermark.Bounds()
	pos := p.calculateWatermarkPosition(bounds.Dx(), bounds.Dy(), wmBounds.Dx(), wmBounds.Dy(), opts)

	if opts.Position == PositionTile {
		// Tile watermark
		for y := 0; y < bounds.Dy(); y += wmBounds.Dy() + opts.Margin {
			for x := 0; x < bounds.Dx(); x += wmBounds.Dx() + opts.Margin {
				result = imaging.Overlay(result, watermark, image.Pt(x, y), opts.Opacity)
			}
		}
	} else {
		// Single watermark
		result = imaging.Overlay(result, watermark, pos, opts.Opacity)
	}

	// Get output path
	outputPath, err := p.getOutputPath(inputPath, "")
	if err != nil {
		return "", err
	}

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return "", fmt.Errorf("创建输出目录失败: %w", err)
	}

	// Save
	if err := imaging.Save(result, outputPath); err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	return outputPath, nil
}

// EncodeSteganography embeds a blind watermark into an image
func (p *ImageProcessor) EncodeSteganography(inputPath string, opts *SteganographyOptions) (string, error) {
	return p.EncodeBlindWatermark(inputPath, opts)
}

// DecodeSteganography extracts a blind watermark from an image
func (p *ImageProcessor) DecodeSteganography(inputPath string) (string, error) {
	// Use default options for decoding (backward compatibility)
	return p.DecodeBlindWatermark(inputPath, &SteganographyOptions{Type: "text"})
}

// GenerateFavicon generates favicon files from an image and packages them into a zip file
func (p *ImageProcessor) GenerateFavicon(inputPath string, opts *FaviconOptions) (*FaviconGenerateResult, error) {
	// Load image
	img, err := imaging.Open(inputPath)
	if err != nil {
		return nil, fmt.Errorf("加载图片失败: %w", err)
	}

	// Get output directory
	outputDir := filepath.Join(filepath.Dir(inputPath), "output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("创建输出目录失败: %w", err)
	}

	result := &FaviconGenerateResult{
		OutputPath: outputDir,
		Files:      make(map[string]string),
		Success:    true,
	}

	// Define standard favicon files to generate
	standardFiles := []struct {
		filename string
		size     int
	}{
		{"android-chrome-192x192.png", 192},
		{"android-chrome-512x512.png", 512},
		{"apple-touch-icon.png", 180},
		{"favicon-16x16.png", 16},
		{"favicon-32x32.png", 32},
	}

	// Generate standard PNG files
	for _, file := range standardFiles {
		resized := imaging.Resize(img, file.size, file.size, imaging.Lanczos)
		outputPath := filepath.Join(outputDir, file.filename)

		if err := imaging.Save(resized, outputPath); err != nil {
			result.Error = fmt.Sprintf("生成 %s 失败: %v", file.filename, err)
			result.Success = false
			return result, nil
		}

		result.Files[file.filename] = outputPath
	}

	// Generate favicon.ico (48x48)
	icoImg := imaging.Resize(img, 48, 48, imaging.Lanczos)
	icoPath := filepath.Join(outputDir, "favicon.ico")
	icoFile, err := os.Create(icoPath)
	if err != nil {
		result.Error = fmt.Sprintf("生成 favicon.ico 失败: %v", err)
		result.Success = false
		return result, nil
	}
	if err := encodeICO(icoFile, icoImg); err != nil {
		icoFile.Close()
		result.Error = fmt.Sprintf("生成 favicon.ico 失败: %v", err)
		result.Success = false
		return result, nil
	}
	icoFile.Close()
	result.Files["favicon.ico"] = icoPath

	// Generate site.webmanifest
	manifest := map[string]interface{}{
		"name":             "My Website",
		"short_name":       "My Website",
		"icons": []map[string]interface{}{
			{
				"src":   "/android-chrome-192x192.png",
				"sizes": "192x192",
				"type":  "image/png",
			},
			{
				"src":   "/android-chrome-512x512.png",
				"sizes": "512x512",
				"type":  "image/png",
			},
		},
		"theme_color":      "#ffffff",
		"background_color": "#ffffff",
		"display":          "standalone",
	}

	manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		result.Error = fmt.Sprintf("生成 site.webmanifest 失败: %v", err)
		result.Success = false
		return result, nil
	}

	manifestPath := filepath.Join(outputDir, "site.webmanifest")
	if err := os.WriteFile(manifestPath, manifestJSON, 0644); err != nil {
		result.Error = fmt.Sprintf("生成 site.webmanifest 失败: %v", err)
		result.Success = false
		return result, nil
	}
	result.Files["site.webmanifest"] = manifestPath

	// Create zip file
	zipPath := filepath.Join(outputDir, "favicon.zip")
	zipFile, err := os.Create(zipPath)
	if err != nil {
		result.Error = fmt.Sprintf("创建 zip 文件失败: %v", err)
		result.Success = false
		return result, nil
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Add all generated files to the zip
	for filename, filePath := range result.Files {
		// 使用匿名函数确保每次循环迭代的文件都能被及时关闭
		func() {
			fileToZip, err := os.Open(filePath)
			if err != nil {
				result.Error = fmt.Sprintf("打开文件 %s 失败: %v", filename, err)
				result.Success = false
				return
			}
			defer fileToZip.Close()

			info, err := fileToZip.Stat()
			if err != nil {
				result.Error = fmt.Sprintf("读取文件信息 %s 失败: %v", filename, err)
				result.Success = false
				return
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				result.Error = fmt.Sprintf("创建 zip 头 %s 失败: %v", filename, err)
				result.Success = false
				return
			}

			header.Name = filename
			header.Method = zip.Deflate

			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				result.Error = fmt.Sprintf("添加文件到 zip %s 失败: %v", filename, err)
				result.Success = false
				return
			}

			if _, err := io.Copy(writer, fileToZip); err != nil {
				result.Error = fmt.Sprintf("写入文件到 zip %s 失败: %v", filename, err)
				result.Success = false
				return
			}
		}()

		// 检查是否有错误发生
		if !result.Success {
			return result, nil
		}
	}

	// Clear individual files from result and only return the zip file
	result.Files = map[string]string{"favicon.zip": zipPath}

	return result, nil
}

// getOutputPath generates output path with output/ subdirectory
func (p *ImageProcessor) getOutputPath(inputPath string, newFormat string) (string, error) {
	dir := filepath.Dir(inputPath)
	name := filepath.Base(inputPath)

	// Create output directory
	outputDir := filepath.Join(dir, "output")

	// Change extension if new format specified
	if newFormat != "" {
		ext := filepath.Ext(name)
		name = strings.TrimSuffix(name, ext) + "." + newFormat
	}

	return filepath.Join(outputDir, name), nil
}

// calculateWatermarkPosition calculates watermark position
// 现在使用 OffsetX 和 OffsetY 进行精确定位
// OffsetX: 正数向右，负数向左，0 为居中
// OffsetY: 正数向下，负数向上，0 为居中
func (p *ImageProcessor) calculateWatermarkPosition(imgW, imgH, wmW, wmH int, opts *WatermarkOptions) image.Point {
	// 计算中心位置
	centerX := (imgW - wmW) / 2
	centerY := (imgH - wmH) / 2

	// 应用偏移
	x := centerX + opts.OffsetX
	y := centerY + opts.OffsetY

	// 确保水印在图片范围内
	if x < 0 {
		x = 0
	}
	if x > imgW-wmW {
		x = imgW - wmW
	}
	if y < 0 {
		y = 0
	}
	if y > imgH-wmH {
		y = imgH - wmH
	}

	return image.Pt(x, y)
}

func loadWatermarkImage(path string) (image.Image, error) {
	if strings.HasPrefix(path, "data:") {
		data, err := decodeDataURL(path)
		if err != nil {
			return nil, err
		}
		return imaging.Decode(bytes.NewReader(data))
	}
	return imaging.Open(path)
}

func decodeDataURL(dataURL string) ([]byte, error) {
	comma := strings.Index(dataURL, ",")
	if comma < 0 {
		return nil, errors.New("无效的 data URL")
	}

	meta := dataURL[:comma]
	payload := dataURL[comma+1:]

	if strings.Contains(meta, ";base64") {
		data, err := base64.StdEncoding.DecodeString(payload)
		if err != nil {
			return nil, fmt.Errorf("解析 base64 失败: %w", err)
		}
		return data, nil
	}

	return nil, errors.New("仅支持 base64 编码的 data URL")
}

func buildTextWatermark(opts *WatermarkOptions) (image.Image, error) {
	if strings.TrimSpace(opts.Text) == "" {
		return nil, errors.New("水印文字不能为空")
	}

	fontSize := opts.FontSize
	if fontSize <= 0 {
		fontSize = 24
	}

	face, err := loadFontFace(opts.FontPath, fontSize)
	if err != nil {
		return nil, fmt.Errorf("加载字体失败: %w", err)
	}
	if closer, ok := face.(io.Closer); ok {
		defer closer.Close()
	}

	textColor, err := parseHexColor(opts.FontColor)
	if err != nil {
		textColor = color.RGBA{R: 255, G: 255, B: 255, A: 255}
	}

	bounds, _ := font.BoundString(face, opts.Text)
	textW := (bounds.Max.X - bounds.Min.X).Ceil()
	textH := (bounds.Max.Y - bounds.Min.Y).Ceil()
	if textW <= 0 || textH <= 0 {
		return nil, errors.New("水印文字尺寸无效")
	}

	watermark := imaging.New(textW, textH, color.NRGBA{R: 0, G: 0, B: 0, A: 0})
	drawer := font.Drawer{
		Dst:  watermark,
		Src:  image.NewUniform(color.NRGBA{R: textColor.R, G: textColor.G, B: textColor.B, A: 255}),
		Face: face,
		Dot: fixed.Point26_6{
			X: -bounds.Min.X,
			Y: -bounds.Min.Y,
		},
	}
	drawer.DrawString(opts.Text)

	if opts.Scale > 0 && opts.Scale != 1 {
		newW := int(float64(textW) * opts.Scale)
		newH := int(float64(textH) * opts.Scale)
		if newW > 0 && newH > 0 {
			watermark = imaging.Resize(watermark, newW, newH, imaging.Lanczos)
		}
	}

	return watermark, nil
}

func loadFontFace(fontPath string, fontSize int) (font.Face, error) {
	var fontData []byte
	if fontPath != "" {
		data, err := os.ReadFile(fontPath)
		if err != nil {
			return nil, err
		}
		fontData = data
	} else {
		fontData = goregular.TTF
	}

	parsed, err := opentype.Parse(fontData)
	if err != nil {
		return nil, err
	}

	return opentype.NewFace(parsed, &opentype.FaceOptions{
		Size:    float64(fontSize),
		DPI:     72,
		Hinting: font.HintingFull,
	})
}

// parseHexColor parses a hex color string
func parseHexColor(s string) (color.RGBA, error) {
	if len(s) == 0 {
		return color.RGBA{}, errors.New("empty color string")
	}

	// Remove # if present
	if s[0] == '#' {
		s = s[1:]
	}

	var r, g, b uint8
	_, err := fmt.Sscanf(s, "%02x%02x%02x", &r, &g, &b)
	if err != nil {
		return color.RGBA{}, err
	}

	return color.RGBA{r, g, b, 255}, nil
}

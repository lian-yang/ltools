package imageprocessor

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// ImageProcessorService exposes image processing functionality to the frontend
type ImageProcessorService struct {
	plugin    *ImageProcessorPlugin
	app       *application.App
	processor *ImageProcessor
	mu        chan struct{}
}

// NewImageProcessorService creates a new image processor service
func NewImageProcessorService(plugin *ImageProcessorPlugin, app *application.App) *ImageProcessorService {
	return &ImageProcessorService{
		plugin:    plugin,
		app:       app,
		processor: NewImageProcessor(),
		mu:        make(chan struct{}, 1),
	}
}

// GetImageInfo returns detailed information about an image file
func (s *ImageProcessorService) GetImageInfo(filePath string) (*ImageInfo, error) {
	return s.getImageInfoInternal(filePath)
}

// GetMultipleImageInfo returns information about multiple image files
func (s *ImageProcessorService) GetMultipleImageInfo(filePaths []string) ([]ImageFile, error) {
	paths := collectImagePaths(filePaths)
	results := make([]ImageFile, 0, len(paths))

	for _, path := range paths {
		info, err := s.processor.GetImageInfo(path)
		if err != nil {
			continue // Skip files that can't be read
		}
		results = append(results, *info)
	}

	return results, nil
}

// PreviewImage generates a preview with applied settings
func (s *ImageProcessorService) PreviewImage(filePath string, mode ProcessingMode, options string) (*PreviewResult, error) {
	// Load image
	srcImg, err := imaging.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("加载图片失败: %w", err)
	}

	var processedImg *image.NRGBA
	quality := 85

	switch mode {
	case ModeCompress:
		var opts CompressOptions
		if err := json.Unmarshal([]byte(options), &opts); err != nil {
			return nil, fmt.Errorf("解析选项失败: %w", err)
		}
		processedImg = s.applyCompressionPreview(imaging.Clone(srcImg), &opts)
		quality = opts.Quality
	case ModeCrop:
		var opts CropOptions
		if err := json.Unmarshal([]byte(options), &opts); err != nil {
			return nil, fmt.Errorf("解析选项失败: %w", err)
		}
		rect, err := calculateCropRect(srcImg, &opts)
		if err != nil {
			return nil, err
		}
		processedImg = imaging.Crop(srcImg, rect)
	case ModeWatermark:
		var opts WatermarkOptions
		if err := json.Unmarshal([]byte(options), &opts); err != nil {
			return nil, fmt.Errorf("解析选项失败: %w", err)
		}
		// For preview, just return original (watermark needs external files)
		processedImg = imaging.Clone(srcImg)
	default:
		processedImg = imaging.Clone(srcImg)
	}

	// Generate data URL
	dataURL, err := s.imageToDataURLWithQuality(processedImg, quality)
	if err != nil {
		return nil, err
	}

	return &PreviewResult{
		DataURL: dataURL,
		Width:   processedImg.Bounds().Dx(),
		Height:  processedImg.Bounds().Dy(),
	}, nil
}

// ProcessBatch processes multiple images in batch
func (s *ImageProcessorService) ProcessBatch(request ProcessingRequest) (*BatchProgress, error) {
	// Initialize progress
	s.plugin.progress = &BatchProgress{
		Total:     len(request.Files),
		Completed: 0,
		Failed:    0,
		Results:   make([]ProcessingResult, 0),
		StartTime: time.Now().Unix(),
		IsRunning: true,
	}

	// Process files in goroutine
	go s.processBatchAsync(request)

	return s.plugin.progress, nil
}

// GetProgress returns the current batch processing progress
func (s *ImageProcessorService) GetProgress() *BatchProgress {
	return s.plugin.progress
}

// CancelBatch cancels the current batch processing
func (s *ImageProcessorService) CancelBatch() error {
	s.plugin.cancelFlag = true
	if s.plugin.progress != nil {
		s.plugin.progress.IsRunning = false
	}
	return nil
}

// DecodeSteganography extracts hidden watermark from an image
func (s *ImageProcessorService) DecodeSteganography(filePath string, options string) (*SteganographyDecodeResult, error) {
	var opts SteganographyOptions
	if err := json.Unmarshal([]byte(options), &opts); err != nil {
		return nil, fmt.Errorf("解析选项失败: %w", err)
	}

	message, err := s.processor.DecodeBlindWatermark(filePath, &opts)
	if err != nil {
		return &SteganographyDecodeResult{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &SteganographyDecodeResult{
		Success: true,
		Message: message,
	}, nil
}

// GenerateFavicon generates favicon files from an image
func (s *ImageProcessorService) GenerateFavicon(filePath string, options string) (*FaviconGenerateResult, error) {
	var opts FaviconOptions
	if err := json.Unmarshal([]byte(options), &opts); err != nil {
		return nil, fmt.Errorf("解析选项失败: %w", err)
	}

	return s.processor.GenerateFavicon(filePath, &opts)
}

// CopyFile copies a file from source to destination
func (s *ImageProcessorService) CopyFile(sourcePath string, destPath string) error {
	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("打开源文件失败: %w", err)
	}
	defer sourceFile.Close()

	destFile, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("创建目标文件失败: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return fmt.Errorf("复制文件失败: %w", err)
	}

	return nil
}

// SaveDataURL saves a base64 data URL to a file
// dataURL format: data:image/png;base64,xxxxx or data:image/jpeg;base64,xxxxx
func (s *ImageProcessorService) SaveDataURL(dataURL string, destPath string) error {
	// Parse data URL
	var base64Data string
	var format string

	if strings.HasPrefix(dataURL, "data:image/png;base64,") {
		base64Data = strings.TrimPrefix(dataURL, "data:image/png;base64,")
		format = "png"
	} else if strings.HasPrefix(dataURL, "data:image/jpeg;base64,") {
		base64Data = strings.TrimPrefix(dataURL, "data:image/jpeg;base64,")
		format = "jpeg"
	} else if strings.HasPrefix(dataURL, "data:image/jpg;base64,") {
		base64Data = strings.TrimPrefix(dataURL, "data:image/jpg;base64,")
		format = "jpeg"
	} else if strings.HasPrefix(dataURL, "data:image/webp;base64,") {
		base64Data = strings.TrimPrefix(dataURL, "data:image/webp;base64,")
		format = "webp"
	} else {
		return fmt.Errorf("不支持的 data URL 格式")
	}

	// Decode base64
	imageData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("解码 base64 失败: %w", err)
	}

	// 确保目标目录存在
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	// 如果目标路径没有扩展名，根据格式添加
	ext := filepath.Ext(destPath)
	if ext == "" {
		destPath = destPath + "." + format
	}

	// 写入文件
	if err := os.WriteFile(destPath, imageData, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

// LoadImageAsDataURL reads a local image file and returns it as a data URL
// This is used for loading watermark images in the frontend
func (s *ImageProcessorService) LoadImageAsDataURL(filePath string) (string, error) {
	// Read the file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("读取图片文件失败: %w", err)
	}

	// Detect image format
	var mimeType string
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".png":
		mimeType = "image/png"
	case ".gif":
		mimeType = "image/gif"
	case ".webp":
		mimeType = "image/webp"
	case ".bmp":
		mimeType = "image/bmp"
	case ".svg":
		mimeType = "image/svg+xml"
	default:
		// Try to detect from content
		if len(data) > 4 {
			if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
				mimeType = "image/jpeg"
			} else if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
				mimeType = "image/png"
			} else if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
				mimeType = "image/gif"
			} else if data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 {
				mimeType = "image/webp"
			} else {
				mimeType = "image/png" // Default to PNG
			}
		} else {
			mimeType = "image/png"
		}
	}

	// Encode as base64
	base64Data := base64.StdEncoding.EncodeToString(data)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	return dataURL, nil
}

// getImageInfoInternal loads detailed image information
func (s *ImageProcessorService) getImageInfoInternal(filePath string) (*ImageInfo, error) {
	// Get basic info
	basicInfo, err := s.processor.GetImageInfo(filePath)
	if err != nil {
		return nil, err
	}

	// Load image for additional details
	img, err := imaging.Open(filePath)
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()

	// Check for alpha channel
	hasAlpha := false
	switch img.(type) {
	case *image.RGBA, *image.NRGBA:
		// Check if any pixel has alpha < 255
		for y := bounds.Min.Y; y < bounds.Max.Y && !hasAlpha; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				_, _, _, a := img.At(x, y).RGBA()
				if a < 0xffff {
					hasAlpha = true
					break
				}
			}
		}
	}

	return &ImageInfo{
		ImageFile:    *basicInfo,
		HasAlpha:     hasAlpha,
		BitDepth:     8,  // Standard for most web images
		DPI:          72, // Standard web DPI
		ColorProfile: "sRGB",
		EXIF:         make(map[string]string),
	}, nil
}

// processBatchAsync processes files asynchronously
func (s *ImageProcessorService) processBatchAsync(request ProcessingRequest) {
	s.plugin.cancelFlag = false

	for _, filePath := range request.Files {
		if s.plugin.cancelFlag {
			break
		}

		// Update current file
		s.plugin.progress.Current = filepath.Base(filePath)

		// Emit progress event
		s.emitProgress()

		// Process file
		startTime := time.Now()
		result := ProcessingResult{
			InputPath: filePath,
		}

		// Get input file size
		if stat, err := os.Stat(filePath); err == nil {
			result.SizeBefore = stat.Size()
		}

		// Process based on mode
		var outputPath string
		var err error

		switch request.Mode {
		case ModeCompress:
			if request.Compress != nil {
				outputPath, err = s.processor.CompressImage(filePath, request.Compress)
			}
		case ModeCrop:
			if request.Crop != nil {
				outputPath, err = s.processor.CropImage(filePath, request.Crop)
			}
		case ModeWatermark:
			if request.Watermark != nil {
				outputPath, err = s.processor.AddWatermark(filePath, request.Watermark)
			}
		case ModeSteganography:
			if request.Steganography != nil {
				outputPath, err = s.processor.EncodeSteganography(filePath, request.Steganography)
			}
		case ModeFavicon:
			// Favicon is special - generates multiple files
			var favResult *FaviconGenerateResult
			favResult, err = s.processor.GenerateFavicon(filePath, request.Favicon)
			if favResult != nil && len(favResult.Files) > 0 {
				// Use first file as output path
				for _, path := range favResult.Files {
					outputPath = path
					break
				}
			}
		}

		if err != nil {
			result.Success = false
			result.Error = err.Error()
			s.plugin.progress.Failed++
		} else {
			result.Success = true
			result.OutputPath = outputPath
			s.plugin.progress.Completed++

			// Get output file size
			if stat, err := os.Stat(outputPath); err == nil {
				result.SizeAfter = stat.Size()
			}
		}

		result.Duration = time.Since(startTime).Milliseconds()
		s.plugin.progress.Results = append(s.plugin.progress.Results, result)

		// Emit progress event
		s.emitProgress()
	}

	s.plugin.progress.IsRunning = false
	s.emitProgress()
	s.emitComplete()
}

// emitProgress emits a progress event
func (s *ImageProcessorService) emitProgress() {
	if s.app != nil && s.plugin.progress != nil {
		s.app.Event.Emit("imageprocessor:progress", s.plugin.progress)
	}
}

// emitComplete emits a completion event
func (s *ImageProcessorService) emitComplete() {
	if s.app != nil {
		s.app.Event.Emit("imageprocessor:complete", s.plugin.progress)
	}
}

// applyCompressionPreview applies compression settings for preview
func (s *ImageProcessorService) applyCompressionPreview(srcImg *image.NRGBA, opts *CompressOptions) *image.NRGBA {
	img := imaging.Clone(srcImg)

	// Resize if max dimensions specified
	if opts.MaxWidth > 0 || opts.MaxHeight > 0 {
		img = imaging.Resize(img, opts.MaxWidth, opts.MaxHeight, imaging.Lanczos)
	}

	return img
}

// imageToDataURLWithQuality converts an image to a base64 data URL with JPEG quality.
func (s *ImageProcessorService) imageToDataURLWithQuality(img *image.NRGBA, quality int) (string, error) {
	if quality < 1 || quality > 100 {
		quality = 85
	}

	var buf strings.Builder
	if err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(quality)); err != nil {
		return "", err
	}

	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString([]byte(buf.String())), nil
}

// GetSystemFonts returns a list of available system fonts
func (s *ImageProcessorService) GetSystemFonts() ([]FontInfo, error) {
	return getSystemFonts()
}

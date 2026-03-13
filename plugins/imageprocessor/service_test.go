package imageprocessor

import (
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPreviewImage_CropAspectRatio(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	writeTestPNGWithSize(t, inputPath, 400, 200, color.NRGBA{R: 12, G: 34, B: 56, A: 255})

	service := NewImageProcessorService(nil, nil)
	options, err := json.Marshal(CropOptions{
		AspectRatio: "1:1",
	})
	if err != nil {
		t.Fatalf("marshal options: %v", err)
	}

	result, err := service.PreviewImage(inputPath, ModeCrop, string(options))
	if err != nil {
		t.Fatalf("PreviewImage error: %v", err)
	}

	if result.Width != 200 || result.Height != 200 {
		t.Fatalf("expected 200x200 preview, got %dx%d", result.Width, result.Height)
	}
}

func TestPreviewImage_CompressQualityAffectsPreview(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "pattern.png")
	writePatternPNG(t, inputPath, 320, 200)

	service := NewImageProcessorService(nil, nil)

	lowOptions, err := json.Marshal(CompressOptions{Quality: 10})
	if err != nil {
		t.Fatalf("marshal low options: %v", err)
	}
	highOptions, err := json.Marshal(CompressOptions{Quality: 95})
	if err != nil {
		t.Fatalf("marshal high options: %v", err)
	}

	lowResult, err := service.PreviewImage(inputPath, ModeCompress, string(lowOptions))
	if err != nil {
		t.Fatalf("PreviewImage low quality error: %v", err)
	}
	highResult, err := service.PreviewImage(inputPath, ModeCompress, string(highOptions))
	if err != nil {
		t.Fatalf("PreviewImage high quality error: %v", err)
	}

	lowBytes := decodeJPEGDataURL(t, lowResult.DataURL)
	highBytes := decodeJPEGDataURL(t, highResult.DataURL)

	if len(lowBytes) >= len(highBytes) {
		t.Fatalf("expected low quality preview smaller than high quality; low=%d high=%d", len(lowBytes), len(highBytes))
	}
}

func writePatternPNG(t *testing.T, path string, width, height int) {
	t.Helper()

	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r := uint8((x*31 + y*17) % 256)
			g := uint8((x*13 + y*29) % 256)
			b := uint8((x*7 + y*11) % 256)
			img.SetNRGBA(x, y, color.NRGBA{R: r, G: g, B: b, A: 255})
		}
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("create dir: %v", err)
	}

	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create file: %v", err)
	}
	defer file.Close()

	if err := png.Encode(file, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
}

func decodeJPEGDataURL(t *testing.T, dataURL string) []byte {
	t.Helper()

	const prefix = "data:image/jpeg;base64,"
	if !strings.HasPrefix(dataURL, prefix) {
		t.Fatalf("unexpected data URL prefix: %s", dataURL[:min(32, len(dataURL))])
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(dataURL, prefix))
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}
	return decoded
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

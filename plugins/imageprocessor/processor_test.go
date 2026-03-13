package imageprocessor

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func writeTestPNGWithSize(t *testing.T, path string, width, height int, fill color.NRGBA) {
	t.Helper()

	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), &image.Uniform{C: fill}, image.Point{}, draw.Src)

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

func TestAddWatermark_Text(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	writeTestPNGWithSize(t, inputPath, 200, 120, color.NRGBA{R: 10, G: 20, B: 30, A: 255})

	processor := NewImageProcessor()
	outputPath, err := processor.AddWatermark(inputPath, &WatermarkOptions{
		Type:      "text",
		Text:      "LTools",
		FontSize:  18,
		FontColor: "#FFAA00",
		Position:  PositionCenter,
		Opacity:   0.6,
		Margin:    12,
		Scale:     1,
	})
	if err != nil {
		t.Fatalf("AddWatermark(text) error: %v", err)
	}

	if _, err := os.Stat(outputPath); err != nil {
		t.Fatalf("output not found: %v", err)
	}
}

func TestAddWatermark_ImageDataURL(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	writeTestPNGWithSize(t, inputPath, 180, 100, color.NRGBA{R: 50, G: 60, B: 70, A: 255})

	// Build a tiny watermark image and convert to data URL.
	wm := image.NewNRGBA(image.Rect(0, 0, 20, 12))
	draw.Draw(wm, wm.Bounds(), &image.Uniform{C: color.NRGBA{R: 250, G: 100, B: 20, A: 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := png.Encode(&buf, wm); err != nil {
		t.Fatalf("encode watermark png: %v", err)
	}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	processor := NewImageProcessor()
	outputPath, err := processor.AddWatermark(inputPath, &WatermarkOptions{
		Type:     "image",
		ImagePath: dataURL,
		Position: PositionBottomRight,
		Opacity:  0.5,
		Margin:   10,
		Scale:    1,
	})
	if err != nil {
		t.Fatalf("AddWatermark(image data url) error: %v", err)
	}

	if _, err := os.Stat(outputPath); err != nil {
		t.Fatalf("output not found: %v", err)
	}
}

func TestGenerateFavicon_ICO(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	writeTestPNGWithSize(t, inputPath, 128, 128, color.NRGBA{R: 120, G: 130, B: 140, A: 255})

	processor := NewImageProcessor()
	result, err := processor.GenerateFavicon(inputPath, &FaviconOptions{})
	if err != nil {
		t.Fatalf("GenerateFavicon error: %v", err)
	}

	if !result.Success {
		t.Fatalf("expected success, got error: %s", result.Error)
	}

	// Check that zip file was created
	zipPath, ok := result.Files["favicon.zip"]
	if !ok || zipPath == "" {
		t.Fatalf("expected favicon.zip file")
	}
	if _, err := os.Stat(zipPath); err != nil {
		t.Fatalf("zip file not found: %v", err)
	}

	// Verify zip file contains all expected files
	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("failed to open zip: %v", err)
	}
	defer zipReader.Close()

	expectedFiles := map[string]bool{
		"android-chrome-192x192.png": false,
		"android-chrome-512x512.png": false,
		"apple-touch-icon.png":       false,
		"favicon-16x16.png":          false,
		"favicon-32x32.png":          false,
		"favicon.ico":                false,
		"site.webmanifest":           false,
	}

	for _, file := range zipReader.File {
		if _, exists := expectedFiles[file.Name]; exists {
			expectedFiles[file.Name] = true
		}
	}

	for filename, found := range expectedFiles {
		if !found {
			t.Fatalf("expected file %s not found in zip", filename)
		}
	}
}

func TestCropImage_InvalidSize(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	writeTestPNGWithSize(t, inputPath, 120, 80, color.NRGBA{R: 10, G: 20, B: 30, A: 255})

	processor := NewImageProcessor()
	_, err := processor.CropImage(inputPath, &CropOptions{
		X:      0,
		Y:      0,
		Width:  0,
		Height: 0,
	})
	if err == nil {
		t.Fatalf("expected error for invalid crop size")
	}
}

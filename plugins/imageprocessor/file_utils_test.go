package imageprocessor

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestCollectImagePaths_ExpandsDirectories(t *testing.T) {
	dir := t.TempDir()
	rootImage := filepath.Join(dir, "root.png")
	subdir := filepath.Join(dir, "nested")
	nestedImage := filepath.Join(subdir, "nested.png")

	if err := os.MkdirAll(subdir, 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	writeTestPNG(t, rootImage)
	writeTestPNG(t, nestedImage)

	paths := collectImagePaths([]string{dir})
	sort.Strings(paths)

	expected := []string{nestedImage, rootImage}
	sort.Strings(expected)

	if len(paths) != len(expected) {
		t.Fatalf("expected %d paths, got %d: %#v", len(expected), len(paths), paths)
	}

	for i, path := range expected {
		if paths[i] != path {
			t.Fatalf("expected %q at index %d, got %q", path, i, paths[i])
		}
	}
}

func TestCollectImagePaths_FiltersNonImages(t *testing.T) {
	dir := t.TempDir()
	imgPath := filepath.Join(dir, "sample.png")
	txtPath := filepath.Join(dir, "notes.txt")

	writeTestPNG(t, imgPath)
	if err := os.WriteFile(txtPath, []byte("not an image"), 0644); err != nil {
		t.Fatalf("write txt: %v", err)
	}

	paths := collectImagePaths([]string{imgPath, txtPath})

	if len(paths) != 1 {
		t.Fatalf("expected 1 image path, got %d: %#v", len(paths), paths)
	}
	if paths[0] != imgPath {
		t.Fatalf("expected %q, got %q", imgPath, paths[0])
	}
}

func writeTestPNG(t *testing.T, path string) {
	t.Helper()

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create png: %v", err)
	}
	defer f.Close()

	img := image.NewNRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.NRGBA{R: 255, A: 255})
	img.Set(1, 1, color.NRGBA{G: 255, A: 255})

	if err := png.Encode(f, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
}

// writeTestPNGWithSize 生成指定尺寸、单色填充的 PNG，用于需要足够容量
// 的频域水印等测试场景
func writeTestPNGWithSize(t *testing.T, path string, w, h int, c color.NRGBA) {
	t.Helper()

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create png: %v", err)
	}
	defer f.Close()

	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}

	if err := png.Encode(f, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
}

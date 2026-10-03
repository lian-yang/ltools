//go:build windows

package apps

import (
	"bytes"
	"encoding/base64"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWindowsIconExtraction(t *testing.T) {
	for _, path := range []string{filepath.Join(os.Getenv("SystemRoot"), "System32", "notepad.exe"), filepath.Join("..", "..", "..", "build", "windows", "icon.ico")} {
		uri, err := ExtractIcon(path)
		if err != nil {
			t.Fatal(err)
		}
		raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(uri, "data:image/png;base64,"))
		if err != nil {
			t.Fatal(err)
		}
		img, err := png.Decode(bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		if img.Bounds().Dx() != 48 || img.Bounds().Dy() != 48 {
			t.Fatal("unexpected icon dimensions")
		}
		visible := false
		for y := 0; y < 48; y++ {
			for x := 0; x < 48; x++ {
				_, _, _, a := img.At(x, y).RGBA()
				if a > 0 {
					visible = true
				}
			}
		}
		if !visible {
			t.Fatal("icon is blank")
		}
	}
	if _, err := ExtractIcon("missing-icon.exe"); err == nil {
		t.Fatal("missing icon should fail")
	}
}

func TestWindowsIconResourcePath(t *testing.T) {
	t.Setenv("LTOOLS_ICON_TEST", "C:\\Program Files\\App")
	path, index := parseWindowsIconPath(`"%LTOOLS_ICON_TEST%\App.exe",-12`)
	if path != `C:\Program Files\App\App.exe` || index != -12 {
		t.Fatalf("bad path/index: %q %d", path, index)
	}
}

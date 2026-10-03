//go:build windows

package apps

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"os"
	"regexp"
	"strconv"
	"strings"
	"unsafe"

	"github.com/lxn/win"
	"golang.org/x/sys/windows"
)

// windowsIconExtractor Windows 图标提取器
type windowsIconExtractor struct{}

// NewIconExtractor 创建 Windows 图标提取器
func NewIconExtractor() IconExtractor {
	return &windowsIconExtractor{}
}

// ExtractIcon 从 .ico 或 .exe 文件提取图标
func (e *windowsIconExtractor) ExtractIcon(iconPath string) (string, error) {
	if iconPath == "" {
		return "", fmt.Errorf("empty icon path")
	}

	path, index := parseWindowsIconPath(iconPath)
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("icon file not found: %w", err)
	}
	wide, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return "", err
	}
	var large, small win.HICON
	count, _, _ := windows.NewLazySystemDLL("shell32.dll").NewProc("ExtractIconExW").Call(
		uintptr(unsafe.Pointer(wide)), uintptr(int64(index)), uintptr(unsafe.Pointer(&large)), uintptr(unsafe.Pointer(&small)), 1)
	if large != 0 {
		defer win.DestroyIcon(large)
	}
	if small != 0 {
		defer win.DestroyIcon(small)
	}
	if count == 0 || count == 0xffffffff {
		return "", fmt.Errorf("no icon in %s", path)
	}
	icon := large
	if icon == 0 {
		icon = small
	}
	if icon == 0 {
		return "", fmt.Errorf("empty icon handle")
	}
	return encodeWindowsIcon(icon)
}

func parseWindowsIconPath(value string) (string, int32) {
	value = strings.TrimSpace(value)
	var index int32
	if comma := strings.LastIndex(value, ","); comma >= 0 {
		if number, err := strconv.ParseInt(strings.TrimSpace(value[comma+1:]), 10, 32); err == nil {
			index = int32(number)
			value = value[:comma]
		}
	}
	value = strings.Trim(strings.TrimSpace(value), `"`)
	value = regexp.MustCompile(`%([^%]+)%`).ReplaceAllStringFunc(value, func(token string) string {
		if expanded, ok := os.LookupEnv(token[1 : len(token)-1]); ok {
			return expanded
		}
		return token
	})
	return value, index
}

func encodeWindowsIcon(icon win.HICON) (string, error) {
	const size = 48
	dc := win.CreateCompatibleDC(0)
	if dc == 0 {
		return "", fmt.Errorf("cannot create icon device context")
	}
	defer win.DeleteDC(dc)
	header := win.BITMAPINFOHEADER{BiSize: uint32(unsafe.Sizeof(win.BITMAPINFOHEADER{})), BiWidth: size, BiHeight: -size, BiPlanes: 1, BiBitCount: 32}
	var bits unsafe.Pointer
	bitmap := win.CreateDIBSection(dc, &header, win.DIB_RGB_COLORS, &bits, 0, 0)
	if bitmap == 0 || bits == nil {
		return "", fmt.Errorf("cannot create icon bitmap")
	}
	defer win.DeleteObject(win.HGDIOBJ(bitmap))
	previous := win.SelectObject(dc, win.HGDIOBJ(bitmap))
	defer win.SelectObject(dc, previous)
	pixels := unsafe.Slice((*byte)(bits), size*size*4)
	clear(pixels)
	if !win.DrawIconEx(dc, 0, 0, icon, size, size, 0, 0, win.DI_NORMAL) {
		return "", fmt.Errorf("cannot draw icon")
	}
	flush := windows.NewLazySystemDLL("gdi32.dll").NewProc("GdiFlush")
	flush.Call()
	black := append([]byte(nil), pixels...)
	for i := range pixels {
		pixels[i] = 255
	}
	if !win.DrawIconEx(dc, 0, 0, icon, size, size, 0, 0, win.DI_NORMAL) {
		return "", fmt.Errorf("cannot draw icon mask")
	}
	flush.Call()
	// Black/white compositing also recovers transparency for legacy icons without alpha.
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for i := 0; i < len(pixels); i += 4 {
		alpha := 255 - (int(pixels[i])-int(black[i])+int(pixels[i+1])-int(black[i+1])+int(pixels[i+2])-int(black[i+2]))/3
		alpha = max(0, min(255, alpha))
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = black[i+2], black[i+1], black[i], byte(alpha)
	}
	var output bytes.Buffer
	if err := png.Encode(&output, img); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(output.Bytes()), nil
}

// ExtractIcon 全局函数提取图标
func ExtractIcon(iconPath string) (string, error) {
	extractor := NewIconExtractor()
	return extractor.ExtractIcon(iconPath)
}

// GetAppDefaultIcon 获取应用的默认图标（emoji）
// Windows 平台的实现
func GetAppDefaultIcon(appName string) string {
	return "🚀" // Windows 平台暂时使用默认图标
}

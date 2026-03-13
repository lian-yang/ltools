package imageprocessor

import (
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

// 常用字体优先级列表（按使用频率排序）
var commonFontPatterns = []string{
	// 中文字体
	"pingfang",
	"heiti",
	"songti",
	"kaiti",
	"fangsong",
	"simhei",
	"simsun",
	"simkai",
	"microsoftyahei",
	"msyh",
	"noto sans cjk",
	"notoserifcjk",
	"source han",
	"wqy",
	"wenquanyi",
	// 英文字体
	"arial",
	"helvetica",
	"times",
	"georgia",
	"verdana",
	"tahoma",
	"trebuchet",
	"palatino",
	"calibri",
	"consolas",
	"courier",
	"lucida",
	"segoe",
	"roboto",
	"san francisco",
	"sf pro",
	"menlo",
	"monaco",
}

// getSystemFonts returns a list of available system fonts
func getSystemFonts() ([]FontInfo, error) {
	var fonts []FontInfo
	fontDirs := getFontDirectories()
	seenFamilies := make(map[string]bool)

	for _, dir := range fontDirs {
		fontsFromDir, err := scanFontDirectory(dir, seenFamilies)
		if err != nil {
			continue // Skip directories that can't be read
		}
		fonts = append(fonts, fontsFromDir...)
	}

	// 按优先级排序：常用字体在前，然后按字母排序
	sort.Slice(fonts, func(i, j int) bool {
		priorityI := getFontPriority(fonts[i])
		priorityJ := getFontPriority(fonts[j])

		// 优先级不同时，优先级高的排前面
		if priorityI != priorityJ {
			return priorityI > priorityJ
		}
		// 优先级相同时，按字体名排序
		return fonts[i].Name < fonts[j].Name
	})

	// Add default font at the beginning
	defaultFont := FontInfo{
		Name:        "默认字体 (Go Regular)",
		Family:      "Go Regular",
		Path:        "",
		Style:       "Regular",
		IsMonospace: true,
	}
	fonts = append([]FontInfo{defaultFont}, fonts...)

	return fonts, nil
}

// getFontPriority 返回字体的优先级（越高越靠前）
func getFontPriority(font FontInfo) int {
	nameLower := strings.ToLower(font.Name)
	familyLower := strings.ToLower(font.Family)

	for i, pattern := range commonFontPatterns {
		if strings.Contains(nameLower, pattern) || strings.Contains(familyLower, pattern) {
			// 匹配越早的模式优先级越高
			return len(commonFontPatterns) - i
		}
	}
	return 0
}

// getFontDirectories returns platform-specific font directories
func getFontDirectories() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			"/System/Library/Fonts",
			"/Library/Fonts",
			filepath.Join(os.Getenv("HOME"), "Library", "Fonts"),
		}
	case "windows":
		// Windows font directory is usually at C:\Windows\Fonts
		systemRoot := os.Getenv("SystemRoot")
		if systemRoot == "" {
			systemRoot = "C:\\Windows"
		}
		return []string{
			filepath.Join(systemRoot, "Fonts"),
		}
	case "linux":
		home := os.Getenv("HOME")
		return []string{
			"/usr/share/fonts",
			"/usr/local/share/fonts",
			filepath.Join(home, ".local", "share", "fonts"),
			filepath.Join(home, ".fonts"),
		}
	default:
		return []string{}
	}
}

// scanFontDirectory scans a directory for font files
func scanFontDirectory(dir string, seenFamilies map[string]bool) ([]FontInfo, error) {
	var fonts []FontInfo

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// Recursively scan subdirectories
			subFonts, _ := scanFontDirectory(filepath.Join(dir, entry.Name()), seenFamilies)
			fonts = append(fonts, subFonts...)
			continue
		}

		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))

		// Check for supported font formats
		if ext != ".ttf" && ext != ".otf" && ext != ".ttc" {
			continue
		}

		// Parse font name from filename
		fontInfo := parseFontName(name, filepath.Join(dir, name))
		if fontInfo.Family == "" {
			continue
		}

		// Skip duplicate families (keep first occurrence)
		if seenFamilies[fontInfo.Family] {
			continue
		}
		seenFamilies[fontInfo.Family] = true

		fonts = append(fonts, fontInfo)
	}

	return fonts, nil
}

// parseFontName extracts font information from filename
func parseFontName(filename, path string) FontInfo {
	// Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Common style suffixes to detect
	styles := []string{
		"-Bold", "-Italic", "-BoldItalic", "-BoldOblique",
		"-Light", "-LightItalic", "-Medium", "-MediumItalic",
		"-Regular", "-Roman", "-Thin", "-ExtraLight", "-SemiBold",
		"-Black", "-Heavy", "-Ultra", "-Condensed", "-Expanded",
		" Bold", " Italic", " BoldItalic", " Light", " Medium", " Regular",
		" Thin", " Black", " Heavy", " Condensed", " Expanded",
	}

	// Try to extract family name and style
	family := name
	style := "Regular"
	isMono := false

	// Check for monospace indicators
	monoIndicators := []string{"Mono", "Code", "Console", "Terminal", "Courier", "Fixed"}
	for _, indicator := range monoIndicators {
		if strings.Contains(name, indicator) {
			isMono = true
			break
		}
	}

	// Extract style from name
	for _, s := range styles {
		if strings.Contains(name, s) {
			style = strings.TrimSpace(strings.TrimPrefix(s, "-"))
			if style == "" {
				style = strings.TrimSpace(s)
			}
			family = strings.ReplaceAll(name, s, "")
			break
		}
	}

	// Clean up family name
	family = strings.ReplaceAll(family, "-", " ")
	family = strings.TrimSpace(family)

	// If family name is empty, use the original name
	if family == "" {
		family = name
	}

	return FontInfo{
		Name:        name,
		Family:      family,
		Path:        path,
		Style:       style,
		IsMonospace: isMono,
	}
}

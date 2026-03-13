package imageprocessor

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

var supportedImageExtensions = map[string]struct{}{
	".bmp":  {},
	".gif":  {},
	".ico":  {},
	".jpeg": {},
	".jpg":  {},
	".png":  {},
	".tif":  {},
	".tiff": {},
	".webp": {},
}

func collectImagePaths(paths []string) []string {
	results := make([]string, 0)
	seen := make(map[string]struct{})

	for _, path := range paths {
		if path == "" {
			continue
		}

		info, err := os.Stat(path)
		if err != nil {
			continue
		}

		if info.IsDir() {
			_ = filepath.WalkDir(path, func(entry string, d fs.DirEntry, err error) error {
				if err != nil || d == nil || d.IsDir() {
					return nil
				}
				if !isSupportedImagePath(entry) {
					return nil
				}
				if _, exists := seen[entry]; exists {
					return nil
				}
				seen[entry] = struct{}{}
				results = append(results, entry)
				return nil
			})
			continue
		}

		if !isSupportedImagePath(path) {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		results = append(results, path)
	}

	return results
}

func isSupportedImagePath(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == "" {
		return false
	}
	_, ok := supportedImageExtensions[ext]
	return ok
}

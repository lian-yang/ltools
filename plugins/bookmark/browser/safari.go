package browser

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"howett.net/plist"
)

// SafariParser Safari 书签解析器
type SafariParser struct {
	bookmarksPath string
	lastError     error
}

// NewSafariParser 创建 Safari 解析器
func NewSafariParser() *SafariParser {
	return &SafariParser{}
}

// Name 返回浏览器名称
func (p *SafariParser) Name() string {
	return "Safari"
}

// GetLastError 获取最后的错误
func (p *SafariParser) GetLastError() error {
	return p.lastError
}

// GetBookmarksPath 获取书签文件路径
func (p *SafariParser) GetBookmarksPath() (string, error) {
	if p.bookmarksPath != "" {
		return p.bookmarksPath, nil
	}

	// Safari 仅在 macOS 上可用
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("Safari is only available on macOS")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	p.bookmarksPath = filepath.Join(homeDir, "Library", "Safari", "Bookmarks.plist")
	return p.bookmarksPath, nil
}

// IsAvailable 检查 Safari 是否可用
func (p *SafariParser) IsAvailable() bool {
	path, err := p.GetBookmarksPath()
	if err != nil {
		p.lastError = err
		return false
	}

	// 检查文件是否存在
	info, err := os.Stat(path)
	if err != nil {
		if os.IsPermission(err) || isPermissionError(err) {
			p.lastError = fmt.Errorf("需要「完全磁盘访问」权限才能读取 Safari 书签。请在系统偏好设置 > 隐私与安全性 > 完全磁盘访问 中添加此应用")
		} else {
			p.lastError = fmt.Errorf("无法访问 Safari 书签文件: %w", err)
		}
		return false
	}

	// 尝试读取文件以验证权限
	file, err := os.Open(path)
	if err != nil {
		if os.IsPermission(err) || isPermissionError(err) {
			p.lastError = fmt.Errorf("需要「完全磁盘访问」权限才能读取 Safari 书签。请在系统偏好设置 > 隐私与安全性 > 完全磁盘访问 中添加此应用")
		} else {
			p.lastError = fmt.Errorf("无法读取 Safari 书签文件: %w", err)
		}
		return false
	}
	file.Close()

	// 文件存在且可读
	_ = info
	p.lastError = nil
	return true
}

// isPermissionError 检查是否是权限错误
func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	// EPERM (operation not permitted) 或 EACCES (permission denied)
	if pathErr, ok := err.(*os.PathError); ok {
		if errno, ok := pathErr.Err.(syscall.Errno); ok {
			return errno == syscall.EPERM || errno == syscall.EACCES
		}
	}
	return os.IsPermission(err)
}

// safariBookmarkItem Safari 书签 plist 结构
type safariBookmarkItem struct {
	Title           string                 `plist:"Title"`
	URLString       string                 `plist:"URLString"`
	BookmarkType    string                 `plist:"BookmarkType"`    // legacy field
	WebBookmarkType string                 `plist:"WebBookmarkType"` // "WebBookmarkTypeList" or "WebBookmarkTypeLeaf"
	Children        []safariBookmarkItem   `plist:"Children"`
	WebBookmarkUUID string                 `plist:"WebBookmarkUUID"`
	DateAdded       *time.Time             `plist:"DateAdded"`
	DescendantCount int                    `plist:"DescendantCount"`
	URIDictionary   map[string]interface{} `plist:"URIDictionary"`
}

// safariBookmarksRoot Safari 书签根结构
type safariBookmarksRoot struct {
	Children []safariBookmarkItem `plist:"Children"`
}

// Parse 解析 Safari 书签
func (p *SafariParser) Parse() ([]Bookmark, error) {
	path, err := p.GetBookmarksPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsPermission(err) || isPermissionError(err) {
			p.lastError = fmt.Errorf("需要「完全磁盘访问」权限才能读取 Safari 书签。请在系统偏好设置 > 隐私与安全性 > 完全磁盘访问 中添加此应用")
			return nil, p.lastError
		}
		return nil, fmt.Errorf("failed to read bookmarks file: %w", err)
	}

	var root safariBookmarksRoot
	if _, err := plist.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("failed to parse bookmarks plist: %w", err)
	}

	var bookmarks []Bookmark

	// 遍历根节点的子节点
	for _, child := range root.Children {
		// 跳过非书签类型的根节点（如 Reading List）
		if child.Title == "com.apple.ReadingList" {
			continue
		}

		bookmarks = append(bookmarks, p.parseItem(&child, "")...)
	}

	return bookmarks, nil
}

// parseItem 递归解析书签项
func (p *SafariParser) parseItem(item *safariBookmarkItem, folderPath string) []Bookmark {
	var bookmarks []Bookmark

	bookmarkType := item.BookmarkType
	if item.WebBookmarkType != "" {
		bookmarkType = item.WebBookmarkType
	}

	// 如果是书签（叶子节点）
	if bookmarkType == "WebBookmarkTypeLeaf" && item.URLString != "" {
		addedAt := time.Now()
		if item.DateAdded != nil {
			addedAt = *item.DateAdded
		}

		title := item.Title
		if title == "" && item.URIDictionary != nil {
			if v, ok := item.URIDictionary["title"]; ok {
				if s, ok := v.(string); ok {
					title = s
				}
			}
		}

		bookmarks = append(bookmarks, Bookmark{
			ID:      generateID(item.URLString),
			Title:   title,
			URL:     item.URLString,
			Folder:  folderPath,
			Browser: "safari",
			AddedAt: addedAt,
		})
	}

	// 如果是文件夹（列表节点）
	if bookmarkType == "WebBookmarkTypeList" && len(item.Children) > 0 {
		// 特殊处理根文件夹名称
		newPath := folderPath
		if item.Title != "" && item.Title != "BookmarksBar" && item.Title != "BookmarksMenu" {
			if folderPath == "" {
				newPath = item.Title
			} else {
				newPath = folderPath + "/" + item.Title
			}
		} else if item.Title == "BookmarksBar" {
			newPath = "书签栏"
		} else if item.Title == "BookmarksMenu" {
			newPath = "书签菜单"
		}

		for i := range item.Children {
			bookmarks = append(bookmarks, p.parseItem(&item.Children[i], newPath)...)
		}
	}

	return bookmarks
}

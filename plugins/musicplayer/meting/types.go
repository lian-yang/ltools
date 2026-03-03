package meting

import (
	"fmt"
	"time"
)

// MetingError 统一的错误类型
type MetingError struct {
	Platform string // 平台名称
	Method   string // 方法名称
	Message  string // 错误消息
	Original error  // 原始错误
}

// Error 实现 error 接口
func (e *MetingError) Error() string {
	if e.Original != nil {
		return fmt.Sprintf("[meting:%s:%s] %s: %v", e.Platform, e.Method, e.Message, e.Original)
	}
	return fmt.Sprintf("[meting:%s:%s] %s", e.Platform, e.Method, e.Message)
}

// Unwrap 支持错误解包
func (e *MetingError) Unwrap() error {
	return e.Original
}

// NewMetingError 创建 Meting 错误
func NewMetingError(platform, method, message string, original error) *MetingError {
	return &MetingError{
		Platform: platform,
		Method:   method,
		Message:  message,
		Original: original,
	}
}

// SearchType 搜索类型
type SearchType int

const (
	SearchTypeSong     SearchType = iota + 1 // 搜索歌曲
	SearchTypeAlbum                          // 搜索专辑
	SearchTypeArtist                         // 搜索歌手
	SearchTypePlaylist                       // 搜索歌单
)

// Song 歌曲信息（标准化格式）
type Song struct {
	ID       string   `json:"id"`        // 歌曲 ID
	Name     string   `json:"name"`      // 歌曲名
	Artist   []string `json:"artist"`    // 歌手列表
	Album    string   `json:"album"`     // 专辑名
	PicID    string   `json:"pic_id"`    // 封面 ID
	URLID    string   `json:"url_id"`    // 播放 URL ID
	LyricID  string   `json:"lyric_id"`  // 歌词 ID
	Source   string   `json:"source"`    // 来源平台
	Duration int      `json:"duration"`  // 时长（秒）
}

// SongURL 播放地址信息
type SongURL struct {
	URL     string `json:"url"`      // 播放地址
	Size    int64  `json:"size"`     // 文件大小
	Bitrate int    `json:"bitrate"`  // 码率
}

// Album 专辑信息
type Album struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Artist []string `json:"artist"`
	Pic    string   `json:"pic"`
}

// Artist 歌手信息
type Artist struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Pic    string  `json:"pic"`
	Albums []Album `json:"albums"`
}

// Lyric 歌词信息
type Lyric struct {
	Lyric string `json:"lyric"` // 歌词内容
	TLyric string `json:"tlyric"` // 翻译歌词
}

// Playlist 歌单信息
type Playlist struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Cover  string `json:"cover"`
	Creator string `json:"creator"`
	CreateTime time.Time `json:"create_time"`
}

// SearchOption 搜索选项
type SearchOption func(*SearchOptions)

// SearchOptions 搜索选项结构
type SearchOptions struct {
	Type  SearchType // 搜索类型
	Page  int        // 页码
	Limit int        // 每页数量
}

// WithType 设置搜索类型
func WithType(t SearchType) SearchOption {
	return func(o *SearchOptions) {
		o.Type = t
	}
}

// WithPage 设置页码
func WithPage(page int) SearchOption {
	return func(o *SearchOptions) {
		o.Page = page
	}
}

// WithLimit 设置每页数量
func WithLimit(limit int) SearchOption {
	return func(o *SearchOptions) {
		o.Limit = limit
	}
}

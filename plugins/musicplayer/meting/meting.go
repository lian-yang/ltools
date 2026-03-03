package meting

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Meting Meting 主类
type Meting struct {
	platform Platform
	format   bool          // 是否格式化输出
	cookie   string        // Cookie 字符串
	timeout  time.Duration // 请求超时时间
	client   *http.Client  // HTTP 客户端
	retries  int           // 重试次数
}

const (
	defaultTimeout = 20 * time.Second
	defaultRetries = 3
)

// Format 设置是否格式化输出（链式调用）
func (m *Meting) Format(enable bool) *Meting {
	m.format = enable
	return m
}

// Cookie 设置 Cookie（链式调用）
func (m *Meting) Cookie(cookie string) *Meting {
	m.cookie = cookie
	return m
}

// Timeout 设置请求超时（链式调用）
func (m *Meting) Timeout(timeout time.Duration) *Meting {
	m.timeout = timeout
	// 更新 HTTP 客户端的超时设置
	if m.client != nil {
		m.client.Timeout = timeout
	}
	return m
}

// Retries 设置重试次数（链式调用）
func (m *Meting) Retries(retries int) *Meting {
	m.retries = retries
	return m
}

// executeWithRetry 带重试机制的执行函数
func (m *Meting) executeWithRetry(ctx context.Context, operation string, fn func() error) error {
	var lastErr error

	for i := 0; i < m.retries; i++ {
		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// 如果是上下文取消，不再重试
		if ctx.Err() != nil {
			return NewMetingError(
				m.platform.Name(),
				operation,
				"请求被取消",
				ctx.Err(),
			)
		}

		// 如果不是最后一次重试，等待一段时间
		if i < m.retries-1 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Second):
				// 继续下一次重试
			}
		}
	}

	// 所有重试都失败了
	return NewMetingError(
		m.platform.Name(),
		operation,
		fmt.Sprintf("重试 %d 次后仍然失败", m.retries),
		lastErr,
	)
}

// Search 搜索歌曲
func (m *Meting) Search(keyword string, opts ...SearchOption) ([]Song, error) {
	// 默认参数
	options := &SearchOptions{
		Type:  SearchTypeSong, // 默认搜索歌曲
		Page:  1,
		Limit: 30,
	}

	// 应用选项
	for _, opt := range opts {
		opt(options)
	}

	// 根据搜索类型调用不同的平台方法
	// 注意：当前所有平台仅实现了歌曲搜索，其他类型的搜索需要后续实现
	if options.Type == SearchTypeSong {
		songs, err := m.platform.Search(keyword, options.Page, options.Limit)
		if err != nil {
			return nil, NewMetingError(
				m.platform.Name(),
				"Search",
				fmt.Sprintf("搜索失败: keyword=%s, page=%d, limit=%d", keyword, options.Page, options.Limit),
				err,
			)
		}
		return songs, nil
	}

	// 其他搜索类型暂不支持，返回友好错误
	return nil, NewMetingError(
		m.platform.Name(),
		"Search",
		fmt.Sprintf("搜索类型 %d 暂不支持，目前仅支持搜索歌曲", options.Type),
		nil,
	)
}

// Song 获取歌曲详情
func (m *Meting) Song(id string) (*Song, error) {
	song, err := m.platform.Song(id)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"Song",
			fmt.Sprintf("获取歌曲详情失败: id=%s", id),
			err,
		)
	}
	return song, nil
}

// URL 获取播放地址
func (m *Meting) URL(id string, bitrate int) (*SongURL, error) {
	if bitrate == 0 {
		bitrate = 320 // 默认 320kbps
	}
	url, err := m.platform.URL(id, bitrate)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"URL",
			fmt.Sprintf("获取播放地址失败: id=%s, bitrate=%d", id, bitrate),
			err,
		)
	}
	return url, nil
}

// Lyric 获取歌词
func (m *Meting) Lyric(id string) (*Lyric, error) {
	lyric, err := m.platform.Lyric(id)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"Lyric",
			fmt.Sprintf("获取歌词失败: id=%s", id),
			err,
		)
	}
	return lyric, nil
}

// Pic 获取封面图片地址
func (m *Meting) Pic(id string, size int) (string, error) {
	if size == 0 {
		size = 300 // 默认 300px
	}
	url, err := m.platform.Pic(id, size)
	if err != nil {
		return "", NewMetingError(
			m.platform.Name(),
			"Pic",
			fmt.Sprintf("获取封面图片失败: id=%s, size=%d", id, size),
			err,
		)
	}
	return url, nil
}

// Album 获取专辑信息
func (m *Meting) Album(id string) (*Album, error) {
	album, err := m.platform.Album(id)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"Album",
			fmt.Sprintf("获取专辑信息失败: id=%s", id),
			err,
		)
	}
	return album, nil
}

// Artist 获取歌手信息
func (m *Meting) Artist(id string, limit int) (*Artist, error) {
	if limit == 0 {
		limit = 50 // 默认 50 首
	}
	artist, err := m.platform.Artist(id, limit)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"Artist",
			fmt.Sprintf("获取歌手信息失败: id=%s, limit=%d", id, limit),
			err,
		)
	}
	return artist, nil
}

// Playlist 获取歌单
func (m *Meting) Playlist(id string) ([]Song, error) {
	songs, err := m.platform.Playlist(id)
	if err != nil {
		return nil, NewMetingError(
			m.platform.Name(),
			"Playlist",
			fmt.Sprintf("获取歌单失败: id=%s", id),
			err,
		)
	}
	return songs, nil
}

// SetFormat 设置是否格式化输出
func (m *Meting) SetFormat(format bool) {
	m.format = format
}

// GetPlatform 获取当前平台名称
func (m *Meting) GetPlatform() string {
	return m.platform.Name()
}

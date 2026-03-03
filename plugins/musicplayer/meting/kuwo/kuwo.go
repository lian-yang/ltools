package kuwo

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Song 歌曲信息
type Song struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Artist   []string `json:"artist"`
	Album    string   `json:"album"`
	PicID    string   `json:"pic_id"`
	URLID    string   `json:"url_id"`
	LyricID  string   `json:"lyric_id"`
	Source   string   `json:"source"`
	Duration int      `json:"duration"`
	Rid      string   `json:"rid"` // 酷我特有的 rid
}

// SongURL 播放地址信息
type SongURL struct {
	URL     string `json:"url"`
	Size    int64  `json:"size"`
	Bitrate int    `json:"bitrate"`
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
	Lyric  string `json:"lyric"`
	TLyric string `json:"tlyric"`
}

// KuwoPlatform 酷我音乐平台
type KuwoPlatform struct {
	client *http.Client
}

// NewKuwoPlatform 创建酷我音乐平台实例
func NewKuwoPlatform() *KuwoPlatform {
	return &KuwoPlatform{
		client: &http.Client{},
	}
}

// Name 返回平台名称
func (k *KuwoPlatform) Name() string {
	return "kuwo"
}

// Search 搜索歌曲
func (k *KuwoPlatform) Search(keyword string, page, limit int) ([]Song, error) {
	apiURL := "http://www.kuwo.cn/api/www/search/searchMusicBykeyWord"

	params := url.Values{}
	params.Set("key", keyword)
	params.Set("pn", strconv.Itoa(page))
	params.Set("rn", strconv.Itoa(limit))

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kuwo] Search URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Referer", "http://www.kuwo.cn/search/list")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Cookie", "kw_token=1234567890")
	req.Header.Set("csrf", "1234567890")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("[Kuwo] Search Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var searchResp searchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	songs := make([]Song, 0, len(searchResp.Data.List))
	for _, item := range searchResp.Data.List {
		// 艺术家可能是逗号分隔的字符串
		artists := strings.Split(item.Artist, "、")
		if len(artists) == 1 {
			artists = strings.Split(item.Artist, ",")
		}
		if len(artists) == 1 && item.Artist == "" {
			artists = []string{"未知艺术家"}
		}

		songs = append(songs, Song{
			ID:       strconv.FormatInt(item.Rid, 10),
			Name:     item.Name,
			Artist:   artists,
			Album:    item.Album,
			PicID:    item.Pic,
			URLID:    strconv.FormatInt(item.Rid, 10),
			LyricID:  strconv.FormatInt(item.Rid, 10),
			Source:   "kuwo",
			Duration: item.Duration,
			Rid:      strconv.FormatInt(item.Rid, 10),
		})
	}

	return songs, nil
}

// URL 获取播放地址
func (k *KuwoPlatform) URL(id string, bitrate int) (*SongURL, error) {
	// 酷我音乐需要先获取音乐的 URL
	apiURL := "http://www.kuwo.cn/url"

	params := url.Values{}
	params.Set("format", "mp3")
	params.Set("rid", id)
	params.Set("response", "url")
	params.Set("type", "convert_url3")
	params.Set("br", strconv.Itoa(bitrate)+"k")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kuwo] URL API: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "http://www.kuwo.cn")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Cookie", "kw_token=1234567890")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 响应是直接的URL字符串
	playURL := strings.TrimSpace(string(body))
	playURL = strings.Trim(playURL, `"`)

	log.Printf("[Kuwo] URL Response: %s", playURL)

	if playURL == "" || playURL == "null" {
		return nil, fmt.Errorf("no URL found")
	}

	// 确保 HTTPS
	secureURL := playURL
	if strings.HasPrefix(playURL, "http://") {
		secureURL = strings.Replace(playURL, "http://", "https://", 1)
	}

	return &SongURL{
		URL:     secureURL,
		Size:    0, // 酷我不返回文件大小
		Bitrate: bitrate,
	}, nil
}

// Lyric 获取歌词
func (k *KuwoPlatform) Lyric(id string) (*Lyric, error) {
	apiURL := "http://www.kuwo.cn/api/v1/www/music/playInfo"

	params := url.Values{}
	params.Set("mid", id)
	params.Set("type", "music")
	params.Set("httpsStatus", "1")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kuwo] Lyric URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "http://www.kuwo.cn")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var lyricResp lyricResponse
	if err := json.Unmarshal(body, &lyricResp); err != nil {
		return nil, err
	}

	return &Lyric{
		Lyric:  lyricResp.Data.Lrclink,
		TLyric: "", // 酷我不提供翻译歌词
	}, nil
}

// Pic 获取封面图片地址
func (k *KuwoPlatform) Pic(id string, size int) (string, error) {
	// 酷我的图片 URL 格式
	return fmt.Sprintf("https://img1.kuwo.cn/star/albumcover/%s.jpg", id), nil
}

// Song 获取歌曲详情
func (k *KuwoPlatform) Song(id string) (*Song, error) {
	// TODO: 实现获取歌曲详情
	return nil, fmt.Errorf("song detail not implemented for kuwo music")
}

// Album 获取专辑信息
func (k *KuwoPlatform) Album(id string) (*Album, error) {
	// TODO: 实现获取专辑信息
	return nil, fmt.Errorf("album info not implemented for kuwo music")
}

// Artist 获取歌手信息
func (k *KuwoPlatform) Artist(id string, limit int) (*Artist, error) {
	// TODO: 实现获取歌手信息
	return nil, fmt.Errorf("artist info not implemented for kuwo music")
}

// Playlist 获取歌单
func (k *KuwoPlatform) Playlist(id string) ([]Song, error) {
	// TODO: 实现获取歌单
	return nil, fmt.Errorf("playlist not implemented for kuwo music")
}

// helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// 响应结构体定义
type searchResponse struct {
	Data struct {
		List []struct {
			Rid      int64  `json:"rid"`
			Name     string `json:"name"`
			Artist   string `json:"artist"`
			Album    string `json:"album"`
			Pic      string `json:"pic"`
			Duration int    `json:"duration"`
		} `json:"list"`
	} `json:"data"`
}

type lyricResponse struct {
	Data struct {
		Lrclink string `json:"lrclink"`
	} `json:"data"`
}

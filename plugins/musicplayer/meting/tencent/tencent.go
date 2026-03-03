package tencent

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
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
	Mid      string   `json:"mid"` // 腾讯音乐特有的 mid
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

// TencentPlatform 腾讯音乐平台（QQ音乐）
type TencentPlatform struct {
	client *http.Client
}

// NewTencentPlatform 创建腾讯音乐平台实例
func NewTencentPlatform() *TencentPlatform {
	return &TencentPlatform{
		client: &http.Client{},
	}
}

// Name 返回平台名称
func (t *TencentPlatform) Name() string {
	return "tencent"
}

// Search 搜索歌曲（腾讯音乐无加密，使用 GET 请求）
func (t *TencentPlatform) Search(keyword string, page, limit int) ([]Song, error) {
	// 1. 构造 API URL
	apiURL := "https://c.y.qq.com/soso/fcgi-bin/client_search_cp"

	// 2. 构造请求参数
	params := url.Values{}
	params.Set("w", keyword)
	params.Set("format", "json")
	params.Set("p", strconv.Itoa(page))
	params.Set("n", strconv.Itoa(limit))

	// 3. 发送 GET 请求
	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Tencent] Search URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}
	defer resp.Body.Close()

	// 4. 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("[Tencent] Search Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	// 5. 解析响应
	var searchResp searchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	// 6. 转换为 Song 格式
	songs := make([]Song, 0, len(searchResp.Data.Song.List))
	for _, item := range searchResp.Data.Song.List {
		artists := make([]string, 0, len(item.Singer))
		for _, singer := range item.Singer {
			artists = append(artists, singer.Name)
		}

		songs = append(songs, Song{
			ID:       strconv.FormatInt(item.SongID, 10),
			Name:     item.SongName,
			Artist:   artists,
			Album:    item.AlbumName,
			PicID:    strconv.FormatInt(item.AlbumID, 10),
			URLID:    item.SongMid,
			LyricID:  item.SongMid,
			Source:   "tencent",
			Duration: item.Interval,
			Mid:      item.SongMid,
		})
	}

	return songs, nil
}

// URL 获取播放地址（需要两步：获取 Vkey）
func (t *TencentPlatform) URL(id string, bitrate int) (*SongURL, error) {
	// id 是 songmid
	// 1. 首先获取歌曲详情（包含 media_mid）
	songDetail, err := t.getSongDetail(id)
	if err != nil {
		return nil, err
	}

	// 2. 获取 Vkey
	vkeyData, err := t.getVkey(songDetail.Mid, songDetail.MediaMid, bitrate)
	if err != nil {
		return nil, err
	}

	if vkeyData.URL == "" {
		return nil, fmt.Errorf("no URL found (song may require VIP)")
	}

	return &SongURL{
		URL:     vkeyData.URL,
		Size:    vkeyData.Size,
		Bitrate: vkeyData.Bitrate,
	}, nil
}

// getSongDetail 获取歌曲详情
func (t *TencentPlatform) getSongDetail(mid string) (*songDetail, error) {
	apiURL := "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg"

	params := url.Values{}
	params.Set("songmid", mid)
	params.Set("format", "json")

	fullURL := apiURL + "?" + params.Encode()

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var detailResp struct {
		Data []struct {
			Mid      string `json:"mid"`
			File     struct {
				MediaMid string `json:"media_mid"`
			} `json:"file"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &detailResp); err != nil {
		return nil, err
	}

	if len(detailResp.Data) == 0 {
		return nil, fmt.Errorf("song not found")
	}

	return &songDetail{
		Mid:      detailResp.Data[0].Mid,
		MediaMid: detailResp.Data[0].File.MediaMid,
	}, nil
}

// getVkey 获取播放 Vkey
func (t *TencentPlatform) getVkey(mid, mediaMid string, bitrate int) (*vkeyData, error) {
	// 根据比特率确定文件前缀和格式
	var prefix, ext string
	switch {
	case bitrate >= 320:
		prefix = "M800"
		ext = "mp3"
	case bitrate >= 192:
		prefix = "C600"
		ext = "m4a"
	case bitrate >= 128:
		prefix = "M500"
		ext = "mp3"
	default:
		prefix = "C400"
		ext = "m4a"
	}

	filename := fmt.Sprintf("%s%s.%s", prefix, mediaMid, ext)

	// 构造请求
	apiURL := "https://u.y.qq.com/cgi-bin/musicu.fcg"

	guid := fmt.Sprintf("%d", time.Now().Unix())
	payload := map[string]interface{}{
		"req_0": map[string]interface{}{
			"module": "vkey.GetVkeyServer",
			"method": "CgiGetVkey",
			"param": map[string]interface{}{
				"guid":      guid,
				"songmid":   []string{mid},
				"filename":  []string{filename},
				"songtype":  []int{0},
				"uin":       "0",
				"loginflag": 0,
				"platform":  "20",
			},
		},
	}

	payloadJSON, _ := json.Marshal(payload)

	params := url.Values{}
	params.Set("format", "json")
	params.Set("data", string(payloadJSON))

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Tencent] Vkey URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[Tencent] Vkey Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var vkeyResp vkeyResponse
	if err := json.Unmarshal(body, &vkeyResp); err != nil {
		return nil, err
	}

	if len(vkeyResp.Req0.Data.MidURLInfo) == 0 {
		return nil, fmt.Errorf("no vkey data")
	}

	urlInfo := vkeyResp.Req0.Data.MidURLInfo[0]
	if urlInfo.URL == "" {
		return nil, fmt.Errorf("empty URL")
	}

	// 拼接完整 URL
	fullMusicURL := urlInfo.URL
	if !strings.HasPrefix(fullMusicURL, "http") {
		// 如果返回的是相对路径，需要拼接
		sip := vkeyResp.Req0.Data.SIP[0]
		fullMusicURL = sip + urlInfo.URL
	}

	return &vkeyData{
		URL:     fullMusicURL,
		Size:    0, // 腾讯不返回 size
		Bitrate: bitrate,
	}, nil
}

// helper types
type songDetail struct {
	Mid      string
	MediaMid string
}

type vkeyData struct {
	URL     string
	Size    int64
	Bitrate int
}

// helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Lyric 获取歌词（Base64 编码）
func (t *TencentPlatform) Lyric(id string) (*Lyric, error) {
	apiURL := "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg"

	params := url.Values{}
	params.Set("songmid", id)
	params.Set("format", "json")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Tencent] Lyric URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 解析 JSONP 格式: music.callback({...})
	jsonStr := string(body)
	if strings.HasPrefix(jsonStr, "music.callback(") {
		jsonStr = jsonStr[15 : len(jsonStr)-1]
	}

	var lyricResp struct {
		Lyric string `json:"lyric"`
		Trans string `json:"trans"`
	}

	if err := json.Unmarshal([]byte(jsonStr), &lyricResp); err != nil {
		return nil, err
	}

	// Base64 解码
	lyricBytes, _ := base64.StdEncoding.DecodeString(lyricResp.Lyric)
	transBytes, _ := base64.StdEncoding.DecodeString(lyricResp.Trans)

	// HTML 实体解码（关键步骤，与 Node 版本一致）
	lyric := decodeHtmlEntities(string(lyricBytes))
	tlyric := decodeHtmlEntities(string(transBytes))

	return &Lyric{
		Lyric:  lyric,
		TLyric: tlyric,
	}, nil
}

// decodeHtmlEntities 解码 HTML 实体（与 Node 版本一致）
func decodeHtmlEntities(text string) string {
	if text == "" {
		return text
	}

	// 命名实体
	text = strings.ReplaceAll(text, "&apos;", "'")
	text = strings.ReplaceAll(text, "&quot;", "\"")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&nbsp;", " ")

	// 数字实体 (&#39; &#34; 等)
	re := regexp.MustCompile(`&#(\d+);`)
	text = re.ReplaceAllStringFunc(text, func(m string) string {
		numStr := m[2 : len(m)-1]
		num, err := strconv.Atoi(numStr)
		if err != nil {
			return m
		}
		return string(rune(num))
	})

	// 十六进制实体 (&#x27; 等)
	reHex := regexp.MustCompile(`&#x([0-9a-fA-F]+);`)
	text = reHex.ReplaceAllStringFunc(text, func(m string) string {
		hexStr := m[3 : len(m)-1]
		num, err := strconv.ParseInt(hexStr, 16, 32)
		if err != nil {
			return m
		}
		return string(rune(num))
	})

	return text
}

// Pic 获取封面图片地址
func (t *TencentPlatform) Pic(id string, size int) (string, error) {
	return fmt.Sprintf("https://y.gtimg.cn/music/photo_new/T002R%dx%dM000%s.jpg", size, size, id), nil
}

// Song 获取歌曲详情
func (t *TencentPlatform) Song(id string) (*Song, error) {
	// TODO: 实现获取歌曲详情
	return nil, fmt.Errorf("song detail not implemented for tencent music")
}

// Album 获取专辑信息
func (t *TencentPlatform) Album(id string) (*Album, error) {
	// TODO: 实现获取专辑信息
	return nil, fmt.Errorf("album info not implemented for tencent music")
}

// Artist 获取歌手信息
func (t *TencentPlatform) Artist(id string, limit int) (*Artist, error) {
	// TODO: 实现获取歌手信息
	return nil, fmt.Errorf("artist info not implemented for tencent music")
}

// Playlist 获取歌单
func (t *TencentPlatform) Playlist(id string) ([]Song, error) {
	// TODO: 实现获取歌单
	return nil, fmt.Errorf("playlist not implemented for tencent music")
}

// 响应结构体定义
type searchResponse struct {
	Data struct {
		Song struct {
			List []struct {
				SongID    int64  `json:"songid"`
				SongMid   string `json:"songmid"`
				SongName  string `json:"songname"`
				Singer    []struct {
					Name string `json:"name"`
				} `json:"singer"`
				AlbumName string `json:"albumname"`
				AlbumID   int64  `json:"albumid"`
				Interval  int    `json:"interval"`
			} `json:"list"`
		} `json:"song"`
	} `json:"data"`
}

type vkeyResponse struct {
	Req0 struct {
		Data struct {
			MidURLInfo []struct {
				URL string `json:"purl"`
			} `json:"midurlinfo"`
			SIP []string `json:"sip"`
		} `json:"data"`
	} `json:"req_0"`
}

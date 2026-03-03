package netease

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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
	PicURL   string   `json:"pic_url,omitempty"` // 完整的封面图片 URL
	URLID    string   `json:"url_id"`
	LyricID  string   `json:"lyric_id"`
	Source   string   `json:"source"`
	Duration int      `json:"duration"`
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

// NetEasePlatform 网易云音乐平台
type NetEasePlatform struct {
	client   *http.Client
	deviceID string // 缓存设备 ID
}

// NewNetEasePlatform 创建网易云平台实例
func NewNetEasePlatform() *NetEasePlatform {
	return &NetEasePlatform{
		client:   &http.Client{},
		deviceID: generateDeviceID(),
	}
}

// generateDeviceID 生成设备 ID（16 字节随机数的十六进制大写）
func generateDeviceID() string {
	randomBytes := make([]byte, 16)
	_, err := rand.Read(randomBytes)
	if err != nil {
		// 如果随机生成失败，使用时间戳作为后备
		timestamp := time.Now().UnixNano()
		return fmt.Sprintf("%016X", timestamp)[:32]
	}
	return strings.ToUpper(hex.EncodeToString(randomBytes))
}

// getHeaders 获取完整的请求头配置（模拟 Android 移动端）
func (n *NetEasePlatform) getHeaders() map[string]string {
	timestamp := time.Now().UnixMilli()
	requestID := fmt.Sprintf("%d_%04d", timestamp, time.Now().Nanosecond()/1000000)

	return map[string]string{
		"Referer":          "music.163.com",
		"Cookie":           fmt.Sprintf("osver=android; appver=8.7.01; os=android; deviceId=%s; channel=netease; requestId=%s; __remember_me=true", n.deviceID, requestID),
		"User-Agent":       "Mozilla/5.0 (Linux; Android 11; M2007J3SC Build/RKQ1.200826.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 MQQBrowser/6.2 TBS/045714 Mobile Safari/537.36 NeteaseMusic/8.7.01",
		"Accept":           "*/*",
		"Accept-Language":  "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
		"Connection":       "keep-alive",
		"Content-Type":     "application/x-www-form-urlencoded",
	}
}

// Name 返回平台名称
func (n *NetEasePlatform) Name() string {
	return "netease"
}

// Search 搜索歌曲（使用官方 API + EAPI 加密）
func (n *NetEasePlatform) Search(keyword string, page, limit int) ([]Song, error) {
	// 1. 构造请求参数
	offset := (page - 1) * limit
	params := map[string]string{
		"s":      keyword,
		"type":   strconv.Itoa(SearchTypeSong),
		"limit":  strconv.Itoa(limit),
		"offset": strconv.Itoa(offset),
		"total":  "true",
	}

	// 2. 发送加密请求
	respData, err := n.sendEncryptedRequest(SearchAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var searchResp searchResponse
	if err := json.Unmarshal(respData, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	// 4. 转换为 Song 格式
	songs := make([]Song, 0, len(searchResp.Result.Songs))
	for _, song := range searchResp.Result.Songs {
		artists := make([]string, 0, len(song.Artists))
		for _, artist := range song.Artists {
			artists = append(artists, artist.Name)
		}

		// 提取封面图片信息
		picID := strconv.FormatInt(song.Album.PicID, 10)
		picURL := song.Album.PicURL

		// 优先使用完整的封面 URL，否则使用 PicID
		picValue := picURL
		if picValue == "" {
			picValue = picID
		}

		songs = append(songs, Song{
			ID:       strconv.FormatInt(song.ID, 10),
			Name:     song.Name,
			Artist:   artists,
			Album:    song.Album.Name,
			PicID:    picValue, // 存储完整的 URL 或 ID
			PicURL:   picURL,
			URLID:    strconv.FormatInt(song.ID, 10),
			LyricID:  strconv.FormatInt(song.ID, 10),
			Source:   "netease",
			Duration: song.Duration / 1000,
		})
	}

	return songs, nil
}

// Song 获取歌曲详情
func (n *NetEasePlatform) Song(id string) (*Song, error) {
	// 网易云通过搜索获取歌曲信息
	songs, err := n.Search(id, 1, 1)
	if err != nil || len(songs) == 0 {
		return nil, fmt.Errorf("song not found: %s", id)
	}
	return &songs[0], nil
}

// URL 获取播放地址（使用官方 API + EAPI 加密）
func (n *NetEasePlatform) URL(id string, bitrate int) (*SongURL, error) {
	// 1. 构造请求参数
	params := map[string]string{
		"ids": "[" + id + "]",
		"br":  strconv.Itoa(bitrate),
	}

	// 2. 发送加密请求
	respData, err := n.sendEncryptedRequest(SongURLAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var urlResp songURLResponse
	if err := json.Unmarshal(respData, &urlResp); err != nil {
		return nil, fmt.Errorf("failed to parse URL response: %w", err)
	}

	// 4. 检查是否有有效的 URL
	if len(urlResp.Data) == 0 || urlResp.Data[0].URL == "" {
		return nil, fmt.Errorf("no URL found (song may require VIP)")
	}

	// 5. 返回第一个结果
	result := urlResp.Data[0]
	return &SongURL{
		URL:     result.URL,
		Size:    result.Size,
		Bitrate: result.Bitrate,
	}, nil
}

// Lyric 获取歌词
func (n *NetEasePlatform) Lyric(id string) (*Lyric, error) {
	// 1. 构造请求参数
	params := map[string]string{
		"id": id,
		"lv": "-1",
		"kv": "-1",
		"tv": "-1",
	}

	// 2. 发送加密请求
	respData, err := n.sendEncryptedRequest(LyricAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var lyricResp lyricResponse
	if err := json.Unmarshal(respData, &lyricResp); err != nil {
		return nil, fmt.Errorf("failed to parse lyric response: %w", err)
	}

	return &Lyric{
		Lyric:  lyricResp.Lrc.Lyric,
		TLyric: lyricResp.Tlyric.Lyric,
	}, nil
}

// Pic 获取封面图片地址
func (n *NetEasePlatform) Pic(id string, size int) (string, error) {
	// 如果 id 已经是完整的 URL
	if strings.HasPrefix(id, "http://") || strings.HasPrefix(id, "https://") {
		// 确保 HTTPS
		secureURL := id
		if strings.HasPrefix(id, "http://") {
			secureURL = strings.Replace(id, "http://", "https://", 1)
		}

		// 添加尺寸参数（如果还没有）
		if !strings.Contains(secureURL, "?param=") {
			secureURL += fmt.Sprintf("?param=%dy%d", size, size)
		}

		return secureURL, nil
	}

	// 否则通过 ID 构造 URL（添加尺寸参数）
	return fmt.Sprintf("https://p3.music.126.net/%s/%s.jpg?param=%dy%d", id, id, size, size), nil
}

// Album 获取专辑信息
func (n *NetEasePlatform) Album(id string) (*Album, error) {
	// 1. 构造请求参数
	params := map[string]string{
		"id": id,
	}

	// 2. 发送请求
	respData, err := n.sendRequest(AlbumAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var albumResp albumResponse
	if err := json.Unmarshal(respData, &albumResp); err != nil {
		return nil, fmt.Errorf("failed to parse album response: %w", err)
	}

	artists := make([]string, 0, len(albumResp.Album.Artists))
	for _, artist := range albumResp.Album.Artists {
		artists = append(artists, artist.Name)
	}

	return &Album{
		ID:     strconv.FormatInt(albumResp.Album.ID, 10),
		Name:   albumResp.Album.Name,
		Artist: artists,
		Pic:    albumResp.Album.PicURL,
	}, nil
}

// Artist 获取歌手信息
func (n *NetEasePlatform) Artist(id string, limit int) (*Artist, error) {
	// 1. 构造请求参数
	params := map[string]string{
		"id":     id,
		"limit":  strconv.Itoa(limit),
		"offset": "0",
	}

	// 2. 发送请求
	respData, err := n.sendRequest(ArtistAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var artistResp artistResponse
	if err := json.Unmarshal(respData, &artistResp); err != nil {
		return nil, fmt.Errorf("failed to parse artist response: %w", err)
	}

	albums := make([]Album, 0, len(artistResp.HotAlbums))
	for _, album := range artistResp.HotAlbums {
		artists := make([]string, 0, len(album.Artists))
		for _, artist := range album.Artists {
			artists = append(artists, artist.Name)
		}

		albums = append(albums, Album{
			ID:     strconv.FormatInt(album.ID, 10),
			Name:   album.Name,
			Artist: artists,
			Pic:    album.PicURL,
		})
	}

	return &Artist{
		ID:     id,
		Name:   artistResp.Artist.Name,
		Pic:    artistResp.Artist.PicURL,
		Albums: albums,
	}, nil
}

// Playlist 获取歌单
func (n *NetEasePlatform) Playlist(id string) ([]Song, error) {
	// 1. 构造请求参数
	params := map[string]string{
		"id": id,
	}

	// 2. 发送请求
	respData, err := n.sendRequest(PlaylistAPI, params)
	if err != nil {
		return nil, err
	}

	// 3. 解析响应
	var playlistResp playlistResponse
	if err := json.Unmarshal(respData, &playlistResp); err != nil {
		return nil, fmt.Errorf("failed to parse playlist response: %w", err)
	}

	songs := make([]Song, 0, len(playlistResp.Playlist.Tracks))
	for _, track := range playlistResp.Playlist.Tracks {
		artists := make([]string, 0, len(track.Ar))
		for _, artist := range track.Ar {
			artists = append(artists, artist.Name)
		}

		songs = append(songs, Song{
			ID:       strconv.FormatInt(track.ID, 10),
			Name:     track.Name,
			Artist:   artists,
			Album:    track.Al.Name,
			PicID:    strconv.FormatInt(track.Al.PicID, 10),
			URLID:    strconv.FormatInt(track.ID, 10),
			LyricID:  strconv.FormatInt(track.ID, 10),
			Source:   "netease",
			Duration: track.Dt / 1000,
		})
	}

	return songs, nil
}

// sendRequest 发送普通 HTTP 请求
func (n *NetEasePlatform) sendRequest(apiURL string, params map[string]string) ([]byte, error) {
	// 构造表单数据
	formData := url.Values{}
	for key, value := range params {
		formData.Set(key, value)
	}

	// 发送 POST 请求
	resp, err := n.client.PostForm(apiURL, formData)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return body, nil
}

// sendEncryptedRequest 发送加密请求（使用 EAPI）
func (n *NetEasePlatform) sendEncryptedRequest(apiURL string, params map[string]string) ([]byte, error) {
	// 1. 构造参数 JSON
	paramsJSON := make(map[string]interface{})
	for key, value := range params {
		paramsJSON[key] = value
	}

	// 2. 序列化为 JSON
	jsonData, err := json.Marshal(paramsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal params: %w", err)
	}

	// 调试：打印原始 JSON
	log.Printf("[NetEase] Original JSON: %s", string(jsonData))

	// 3. 提取 URL 路径（去掉域名部分）
	// 例如：https://music.163.com/api/song/lyric -> /api/song/lyric
	parsedURL, err := url.Parse(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse API URL: %w", err)
	}
	urlPath := parsedURL.Path

	// 4. 使用 EAPI 加密参数
	encParams, err := encryptEAPI(urlPath, string(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt params: %w", err)
	}

	// 5. 转换 URL: /api/ -> /eapi/
	eapiURL := eapiEncryptURL(apiURL)

	// 6. 构造表单数据（EAPI 只有 params 字段，没有 encSecKey）
	formData := url.Values{}
	formData.Set("params", encParams)

	// 7. 创建请求
	req, err := http.NewRequest("POST", eapiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 调试：打印请求信息
	log.Printf("[NetEase] EAPI URL: %s", eapiURL)

	// 8. 设置请求头（模拟 Android 移动端）
	headers := n.getHeaders()
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// 9. 发送请求
	resp, err := n.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send encrypted request: %w", err)
	}
	defer resp.Body.Close()

	// 10. 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// 调试：打印响应状态码
	log.Printf("[NetEase] API Response Status: %d", resp.StatusCode)
	log.Printf("[NetEase] API Response Body (first 500 chars): %s", string(body[:min(500, len(body))]))

	// 11. 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
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
	Result struct {
		Songs []struct {
			ID       int64  `json:"id"`
			Name     string `json:"name"`
			Artists  []struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"ar"`
			Album struct {
				ID     int64  `json:"id"`
				Name   string `json:"name"`
				PicID  int64  `json:"pic"`
				PicURL string `json:"picUrl"`
			} `json:"al"`
			Duration int `json:"dt"`
		} `json:"songs"`
	} `json:"result"`
}

type songURLResponse struct {
	Data []struct {
		URL     string `json:"url"`
		Size    int64  `json:"size"`
		Bitrate int    `json:"br"`
	} `json:"data"`
}

type lyricResponse struct {
	Lrc struct {
		Lyric string `json:"lyric"`
	} `json:"lrc"`
	Tlyric struct {
		Lyric string `json:"lyric"`
	} `json:"tlyric"`
}

type albumResponse struct {
	Album struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		PicURL  string `json:"picUrl"`
		Artists []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"artists"`
	} `json:"album"`
}

type artistResponse struct {
	Artist struct {
		ID     int64  `json:"id"`
		Name   string `json:"name"`
		PicURL string `json:"picUrl"`
	} `json:"artist"`
	HotAlbums []struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		PicURL  string `json:"picUrl"`
		Artists []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"artists"`
	} `json:"hotAlbums"`
}

type playlistResponse struct {
	Playlist struct {
		Tracks []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
			Ar   []struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"ar"`
			Al struct {
				ID    int64  `json:"id"`
				Name  string `json:"name"`
				PicID int64  `json:"picId"`
			} `json:"al"`
			Dt int `json:"dt"`
		} `json:"tracks"`
	} `json:"playlist"`
}

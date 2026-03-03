package kugou

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	MD5_KEY = "NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt"
)

// Song 歌曲信息
type Song struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Artist   []string `json:"artist"`
	Album    string   `json:"album"`
	PicID    string   `json:"pic_id"`
	PicURL   string   `json:"pic_url,omitempty"`
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

// KugouPlatform 酷狗音乐平台
type KugouPlatform struct {
	client *http.Client
}

// NewKugouPlatform 创建酷狗音乐平台实例
func NewKugouPlatform() *KugouPlatform {
	return &KugouPlatform{
		client: &http.Client{},
	}
}

// Name 返回平台名称
func (k *KugouPlatform) Name() string {
	return "kugou"
}

// Search 搜索歌曲
func (k *KugouPlatform) Search(keyword string, page, limit int) ([]Song, error) {
	apiURL := "http://mobilecdn.kugou.com/api/v3/search/song"

	params := url.Values{}
	params.Set("api_ver", "1")
	params.Set("area_code", "1")
	params.Set("correct", "1")
	params.Set("pagesize", strconv.Itoa(limit))
	params.Set("plat", "2")
	params.Set("tag", "1")
	params.Set("sver", "5")
	params.Set("showtype", "10")
	params.Set("page", strconv.Itoa(page))
	params.Set("keyword", keyword)
	params.Set("version", "8990")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kugou] Search URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "IPhone-8990-searchSong")
	req.Header.Set("UNI-UserAgent", "iOS11.4-Phone8990-1009-0-WiFi")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("[Kugou] Search Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var searchResp searchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	songs := make([]Song, 0, len(searchResp.Data.Info))
	for _, item := range searchResp.Data.Info {
		// 解析歌手和歌名（与 Node.js 版本一致）
		var name string
		var artists []string

		// 优先使用 filename 解析（格式："歌手 - 歌名"）
		if item.FileName != "" {
			parts := strings.Split(item.FileName, " - ")
			if len(parts) >= 2 {
				// 解析歌手（可能有多个，用 "、" 分隔）
				artists = strings.Split(parts[0], "、")
				name = parts[1]
			} else {
				name = item.SongName
				artists = []string{item.SingerName}
			}
		} else {
			name = item.SongName
			artists = []string{item.SingerName}
		}

		// 提取封面 URL（如果存在）
		picURL := ""
		if item.TransParam.UnionCover != "" {
			picURL = strings.Replace(item.TransParam.UnionCover, "{size}", "400", 1)
		}

		songs = append(songs, Song{
			ID:       item.Hash,
			Name:     name,
			Artist:   artists,
			Album:    item.AlbumName,
			PicID:    item.Hash,
			PicURL:   picURL,
			URLID:    item.Hash,
			LyricID:  item.Hash,
			Source:   "kugou",
			Duration: item.Duration,
		})
	}

	return songs, nil
}

// URL 获取播放地址（老接口，无需 Cookie）
// 需要两步：1) 获取 relate_goods 数组  2) 使用 trackercdn API 获取实际播放链接
func (k *KugouPlatform) URL(id string, bitrate int) (*SongURL, error) {
	// 第一步：调用 get_res_privilege 获取 relate_goods
	apiURL := "http://media.store.kugou.com/v1/get_res_privilege"

	reqData := map[string]interface{}{
		"relate":     1,
		"userid":     "0",
		"vip":        0,
		"appid":      1000,
		"token":      "",
		"behavior":   "download",
		"area_code":  "1",
		"clientver":  "8990",
		"resource": []map[string]interface{}{
			{
				"id":   0,
				"type": "audio",
				"hash": id,
			},
		},
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "IPhone-8990-searchSong")
	req.Header.Set("Content-Type", "application/json")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get URL: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("[Kugou] URL Step1 Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var urlResp urlResponse
	if err := json.Unmarshal(body, &urlResp); err != nil {
		return nil, fmt.Errorf("failed to parse URL response: %w", err)
	}

	if len(urlResp.Data) == 0 || len(urlResp.Data[0].RelateGoods) == 0 {
		return nil, fmt.Errorf("no URL found (song may require VIP)")
	}

	// 第二步：遍历 relate_goods 找到符合码率要求的 hash
	for _, item := range urlResp.Data[0].RelateGoods {
		if item.Info.Bitrate <= bitrate {
			// 使用 trackercdn API 获取实际播放链接
			playURL, err := k.getTrackURL(item.Hash)
			if err != nil {
				log.Printf("[Kugou] Failed to get track URL for hash %s: %v", item.Hash, err)
				continue
			}

			if playURL != "" {
				// 返回第一个可用的 URL
				return &SongURL{
					URL:     playURL,
					Size:    item.Info.FileSize,
					Bitrate: item.Info.Bitrate * 1000,
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("no URL found (song may require VIP)")
}

// getTrackURL 使用 trackercdn API 获取实际播放链接
func (k *KugouPlatform) getTrackURL(hash string) (string, error) {
	// 生成签名 key = md5(hash + "kgcloudv2")
	key := fmt.Sprintf("%x", md5.Sum([]byte(hash+"kgcloudv2")))

	params := url.Values{}
	params.Set("hash", hash)
	params.Set("key", key)
	params.Set("pid", "3")
	params.Set("behavior", "play")
	params.Set("cmd", "25")
	params.Set("version", "8990")

	apiURL := "http://trackercdn.kugou.com/i/v2/?" + params.Encode()
	log.Printf("[Kugou] TrackCDN URL: %s", apiURL)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create track request: %w", err)
	}

	req.Header.Set("User-Agent", "IPhone-8990-searchSong")

	resp, err := k.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get track URL: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read track response: %w", err)
	}

	log.Printf("[Kugou] TrackCDN Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var trackResp trackResponse
	if err := json.Unmarshal(body, &trackResp); err != nil {
		return "", fmt.Errorf("failed to parse track response: %w", err)
	}

	if len(trackResp.URL) == 0 {
		return "", fmt.Errorf("no URL in track response")
	}

	// URL 可能是数组或单个字符串
	playURL := trackResp.URL[0]
	if strings.HasPrefix(playURL, "http://") {
		playURL = strings.Replace(playURL, "http://", "https://", 1)
	}

	return playURL, nil
}

// Lyric 获取歌词
func (k *KugouPlatform) Lyric(id string) (*Lyric, error) {
	apiURL := "http://krcs.kugou.com/search"

	params := url.Values{}
	params.Set("keyword", "%20-%20")
	params.Set("ver", "1")
	params.Set("hash", id)
	params.Set("client", "mobi")
	params.Set("man", "yes")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kugou] Lyric Search URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "IPhone-8990-searchSong")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var lyricSearchResp lyricSearchResponse
	if err := json.Unmarshal(body, &lyricSearchResp); err != nil {
		return nil, err
	}

	if len(lyricSearchResp.Candidates) == 0 {
		return &Lyric{Lyric: "", TLyric: ""}, nil
	}

	// 获取第一个候选歌词
	candidate := lyricSearchResp.Candidates[0]
	lyricAPIURL := fmt.Sprintf("http://krcs.kugou.com/download?ver=1&client=mkt&id=%s&accesskey=%s&fmt=lrc&charset=utf8",
		candidate.ID, candidate.AccessKey)

	lyricReq, err := http.NewRequest("GET", lyricAPIURL, nil)
	if err != nil {
		return nil, err
	}

	lyricReq.Header.Set("User-Agent", "IPhone-8990-searchSong")

	lyricResp, err := k.client.Do(lyricReq)
	if err != nil {
		return nil, err
	}
	defer lyricResp.Body.Close()

	lyricBody, err := io.ReadAll(lyricResp.Body)
	if err != nil {
		return nil, err
	}

	var lyricData lyricDataResponse
	if err := json.Unmarshal(lyricBody, &lyricData); err != nil {
		return nil, err
	}

	return &Lyric{
		Lyric:  lyricData.Content,
		TLyric: "",
	}, nil
}

// Song 获取歌曲详情（用于获取封面）
func (k *KugouPlatform) Song(id string) (*Song, error) {
	apiURL := "http://m.kugou.com/app/i/getSongInfo.php"

	params := url.Values{}
	params.Set("cmd", "playInfo")
	params.Set("hash", id)
	params.Set("from", "mkugou")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Kugou] Song URL: %s", fullURL)

	req, err := http.NewRequest("POST", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "IPhone-8990-searchSong")

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[Kugou] Song Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var songResp songDetailResponse
	if err := json.Unmarshal(body, &songResp); err != nil {
		return nil, err
	}

	// 解析歌手名称
	artists := make([]string, 0)
	if len(songResp.Authors) > 0 {
		for _, author := range songResp.Authors {
			artists = append(artists, author.Name)
		}
	} else if songResp.FileName != "" {
		// 从 filename 解析： "歌手 - 歌名"
		parts := strings.Split(songResp.FileName, " - ")
		if len(parts) >= 2 {
			artists = strings.Split(parts[0], "、")
		}
	}

	return &Song{
		ID:       songResp.Hash,
		Name:     songResp.SongName,
		Artist:   artists,
		Album:    songResp.AlbumName,
		PicID:    songResp.Hash,
		PicURL:   strings.Replace(songResp.ImgURL, "{size}", "400", 1),
		URLID:    songResp.Hash,
		LyricID:  songResp.Hash,
		Source:   "kugou",
		Duration: songResp.Duration,
	}, nil
}

// Pic 获取封面图片地址（通过 Song API 获取）
func (k *KugouPlatform) Pic(id string, size int) (string, error) {
	// 通过 Song API 获取封面图片
	song, err := k.Song(id)
	if err != nil {
		return "", fmt.Errorf("failed to get song info: %w", err)
	}

	if song.PicURL == "" {
		return "", fmt.Errorf("no image URL found")
	}

	// 确保 HTTPS
	secureURL := song.PicURL
	if strings.HasPrefix(song.PicURL, "http://") {
		secureURL = strings.Replace(song.PicURL, "http://", "https://", 1)
	}

	return secureURL, nil
}

// Album 获取专辑信息
func (k *KugouPlatform) Album(id string) (*Album, error) {
	// TODO: 实现获取专辑信息
	return nil, fmt.Errorf("album info not implemented for kugou music")
}

// Artist 获取歌手信息
func (k *KugouPlatform) Artist(id string, limit int) (*Artist, error) {
	// TODO: 实现获取歌手信息
	return nil, fmt.Errorf("artist info not implemented for kugou music")
}

// Playlist 获取歌单
func (k *KugouPlatform) Playlist(id string) ([]Song, error) {
	// TODO: 实现获取歌单
	return nil, fmt.Errorf("playlist not implemented for kugou music")
}

// getSignature 生成签名（用于新接口）
func (k *KugouPlatform) getSignature(params map[string]string) string {
	// 按键名排序
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	// 简化排序，实际可能需要更复杂的排序

	// 构建签名字符串
	var parts []string
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, params[key]))
	}
	signStr := strings.Join(parts, "&") + MD5_KEY

	// MD5 签名
	hash := md5.Sum([]byte(signStr))
	return hex.EncodeToString(hash[:])
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
		Info []struct {
			Hash         string `json:"hash"`
			SongName     string `json:"songname"`
			SingerName   string `json:"singername"`
			FileName     string `json:"filename"`
			AlbumName    string `json:"album_name"`
			Duration     int    `json:"duration"`
			TransParam   struct {
				UnionCover string `json:"union_cover"`
			} `json:"trans_param"`
		} `json:"info"`
	} `json:"data"`
}

type urlResponse struct {
	Status    int    `json:"status"`
	ErrorCode int    `json:"error_code"`
	Message   string `json:"message"`
	Data      []struct {
		Type        string        `json:"type"`
		ID          int64         `json:"id"`
		Hash        string        `json:"hash"`
		Name        string        `json:"name"`
		SingerName  string        `json:"singername"`
		AlbumName   string        `json:"albumname"`
		PlayURL     string        `json:"play_url"`
		FileSize    int64         `json:"filesize"`
		Bitrate     int           `json:"bitrate"`
		Status      int           `json:"status"`
		Privilege   int           `json:"privilege"`
		PayType     int           `json:"pay_type"`
		RelateGoods []relateGood  `json:"relate_goods"`
	} `json:"data"`
}

type relateGood struct {
	Type      string `json:"type"`
	ID        int64  `json:"id"`
	Hash      string `json:"hash"`
	Name      string `json:"name"`
	SingerName string `json:"singername"`
	AlbumName string `json:"albumname"`
	Info      struct {
		Bitrate  int   `json:"bitrate"`
		FileSize int64 `json:"filesize"`
	} `json:"info"`
}

type trackResponse struct {
	URL      []string `json:"url"`
	FileSize int64    `json:"fileSize"`
	BitRate  int      `json:"bitRate"`
}

type lyricSearchResponse struct {
	Candidates []struct {
		ID        string `json:"id"`
		AccessKey string `json:"accesskey"`
	} `json:"candidates"`
}

type lyricDataResponse struct {
	Content string `json:"content"`
}

type songDetailResponse struct {
	Hash       string `json:"hash"`
	SongName   string `json:"songName"`
	FileName   string `json:"fileName"`
	AlbumName  string `json:"album_name"`
	ImgURL     string `json:"imgUrl"`
	Duration   int    `json:"duration"`
	Authors    []struct {
		Name string `json:"author_name"`
	} `json:"authors"`
}

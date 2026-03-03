package baidu

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	AES_KEY = "DBEECF8C50FD160E"
	AES_IV  = "1231021386755796"
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

// BaiduPlatform 百度音乐平台
type BaiduPlatform struct {
	client *http.Client
}

// NewBaiduPlatform 创建百度音乐平台实例
func NewBaiduPlatform() *BaiduPlatform {
	return &BaiduPlatform{
		client: &http.Client{},
	}
}

// Name 返回平台名称
func (b *BaiduPlatform) Name() string {
	return "baidu"
}

// aesEncrypt AES-128-CBC 加密（与 Node 版本一致）
func (b *BaiduPlatform) aesEncrypt(songID string) (string, error) {
	timestamp := time.Now().UnixMilli()
	data := fmt.Sprintf("songid=%s&ts=%d", songID, timestamp)

	block, err := aes.NewCipher([]byte(AES_KEY))
	if err != nil {
		return "", err
	}

	// PKCS7 填充
	padding := aes.BlockSize - len(data)%aes.BlockSize
	data += string(bytes.Repeat([]byte{byte(padding)}, padding))

	// 加密
	ciphertext := make([]byte, len(data))
	mode := cipher.NewCBCEncrypter(block, []byte(AES_IV))
	mode.CryptBlocks(ciphertext, []byte(data))

	// Base64 编码
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Search 搜索歌曲
func (b *BaiduPlatform) Search(keyword string, page, limit int) ([]Song, error) {
	apiURL := "http://musicapi.taihe.com/v1/restserver/ting"

	params := url.Values{}
	params.Set("from", "qianqianmini")
	params.Set("method", "baidu.ting.search.merge")
	params.Set("isNew", "1")
	params.Set("platform", "darwin")
	params.Set("page_no", strconv.Itoa(page))
	params.Set("query", keyword)
	params.Set("version", "11.2.1")
	params.Set("page_size", strconv.Itoa(limit))

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Baidu] Search URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Referer", "http://music.taihe.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) baidu-music/1.2.1 Chrome/66.0.3359.181 Electron/3.0.5 Safari/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "zh-CN")
	req.Header.Set("Content-Type", "application/json;charset=UTF-8")

	// 生成随机 BAIDUID
	baiduid := fmt.Sprintf("%s:FG=1", generateRandomHex(32))
	req.Header.Set("Cookie", fmt.Sprintf("BAIDUID=%s", baiduid))

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("[Baidu] Search Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var searchResp searchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	songs := make([]Song, 0, len(searchResp.Data.Result))
	for _, item := range searchResp.Data.Result {
		artists := make([]string, 0, len(item.Artists))
		for _, artist := range item.Artists {
			artists = append(artists, artist.Name)
		}

		songs = append(songs, Song{
			ID:       strconv.FormatInt(item.ID, 10),
			Name:     item.Title,
			Artist:   artists,
			Album:    item.AlbumName,
			PicID:    item.PicID,
			URLID:    strconv.FormatInt(item.ID, 10),
			LyricID:  strconv.FormatInt(item.ID, 10),
			Source:   "baidu",
			Duration: item.Duration,
		})
	}

	return songs, nil
}

// URL 获取播放地址（使用 AES 加密）
func (b *BaiduPlatform) URL(id string, bitrate int) (*SongURL, error) {
	apiURL := "http://musicapi.taihe.com/v1/restserver/ting"

	params := url.Values{}
	params.Set("from", "qianqianmini")
	params.Set("method", "baidu.ting.song.getInfos")
	params.Set("songid", id)
	params.Set("res", "1")
	params.Set("platform", "darwin")
	params.Set("version", "1.0.0")

	// 使用 AES 加密
	encrypted, err := b.aesEncrypt(id)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt: %w", err)
	}

	params.Set("e", encrypted)

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Baidu] URL API: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "http://music.taihe.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) baidu-music/1.2.1 Chrome/66.0.3359.181 Electron/3.0.5 Safari/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "zh-CN")
	req.Header.Set("Content-Type", "application/json;charset=UTF-8")

	baiduid := fmt.Sprintf("%s:FG=1", generateRandomHex(32))
	req.Header.Set("Cookie", fmt.Sprintf("BAIDUID=%s", baiduid))

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[Baidu] URL Response (first 500 chars): %s", string(body[:min(500, len(body))]))

	var urlResp urlResponse
	if err := json.Unmarshal(body, &urlResp); err != nil {
		return nil, err
	}

	// 按码率选择最佳 URL
	maxBr := 0
	var bestURL struct {
		URL     string
		Size    int64
		Bitrate int
	}

	for _, item := range urlResp.Songurl.URL {
		if item.FileBitrate <= bitrate && item.FileBitrate > maxBr {
			maxBr = item.FileBitrate
			bestURL = struct {
				URL     string
				Size    int64
				Bitrate int
			}{
				URL:     item.FileLink,
				Size:    item.FileSize,
				Bitrate: item.FileBitrate,
			}
		}
	}

	if bestURL.URL == "" {
		return nil, fmt.Errorf("no URL found")
	}

	// 确保 HTTPS
	secureURL := bestURL.URL
	if strings.HasPrefix(bestURL.URL, "http://") {
		secureURL = strings.Replace(bestURL.URL, "http://", "https://", 1)
	}

	return &SongURL{
		URL:     secureURL,
		Size:    bestURL.Size,
		Bitrate: bestURL.Bitrate,
	}, nil
}

// Lyric 获取歌词
func (b *BaiduPlatform) Lyric(id string) (*Lyric, error) {
	apiURL := "http://musicapi.taihe.com/v1/restserver/ting"

	params := url.Values{}
	params.Set("from", "qianqianmini")
	params.Set("method", "baidu.ting.song.lry")
	params.Set("songid", id)
	params.Set("platform", "darwin")
	params.Set("version", "1.0.0")

	fullURL := apiURL + "?" + params.Encode()
	log.Printf("[Baidu] Lyric URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "http://music.taihe.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) baidu-music/1.2.1 Chrome/66.0.3359.181 Electron/3.0.5 Safari/537.36")

	resp, err := b.client.Do(req)
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
		Lyric:  lyricResp.Data.Lrc,
		TLyric: "", // 百度音乐不提供翻译歌词
	}, nil
}

// Pic 获取封面图片地址
func (b *BaiduPlatform) Pic(id string, size int) (string, error) {
	// 通过详情接口获取图片URL
	songDetail, err := b.getSongDetail(id)
	if err != nil {
		return "", err
	}

	// 百度音乐的图片URL格式
	if songDetail.Songinfo.PicRadio != "" {
		return songDetail.Songinfo.PicRadio, nil
	}

	return songDetail.Songinfo.PicSmall, nil
}

// getSongDetail 获取歌曲详情（用于获取封面）
func (b *BaiduPlatform) getSongDetail(id string) (*songDetailResponse, error) {
	apiURL := "http://musicapi.taihe.com/v1/restserver/ting"

	params := url.Values{}
	params.Set("from", "qianqianmini")
	params.Set("method", "baidu.ting.song.getInfos")
	params.Set("songid", id)
	params.Set("res", "1")
	params.Set("platform", "darwin")
	params.Set("version", "1.0.0")

	// 使用 AES 加密
	encrypted, err := b.aesEncrypt(id)
	if err != nil {
		return nil, err
	}

	params.Set("e", encrypted)

	fullURL := apiURL + "?" + params.Encode()

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Referer", "http://music.taihe.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) baidu-music/1.2.1 Chrome/66.0.3359.181 Electron/3.0.5 Safari/537.36")

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var detailResp songDetailResponse
	if err := json.Unmarshal(body, &detailResp); err != nil {
		return nil, err
	}

	return &detailResp, nil
}

// Song 获取歌曲详情
func (b *BaiduPlatform) Song(id string) (*Song, error) {
	// TODO: 实现获取歌曲详情
	return nil, fmt.Errorf("song detail not implemented for baidu music")
}

// Album 获取专辑信息
func (b *BaiduPlatform) Album(id string) (*Album, error) {
	// TODO: 实现获取专辑信息
	return nil, fmt.Errorf("album info not implemented for baidu music")
}

// Artist 获取歌手信息
func (b *BaiduPlatform) Artist(id string, limit int) (*Artist, error) {
	// TODO: 实现获取歌手信息
	return nil, fmt.Errorf("artist info not implemented for baidu music")
}

// Playlist 获取歌单
func (b *BaiduPlatform) Playlist(id string) ([]Song, error) {
	// TODO: 实现获取歌单
	return nil, fmt.Errorf("playlist not implemented for baidu music")
}

// helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func generateRandomHex(length int) string {
	bytes := make([]byte, (length+1)/2)
	for i := range bytes {
		bytes[i] = byte(rand.Intn(16))
	}
	return hex.EncodeToString(bytes)[:length]
}

// 响应结构体定义
type searchResponse struct {
	Data struct {
		Result []struct {
			ID        int64  `json:"song_id"`
			Title     string `json:"title"`
			Artists   []struct {
				Name string `json:"name"`
			} `json:"author"`
			AlbumName string `json:"album_title"`
			PicID     string `json:"pic_id"`
			Duration  int    `json:"file_duration"`
		} `json:"result"`
	} `json:"data"`
}

type urlResponse struct {
	Songurl struct {
		URL []struct {
			FileLink    string `json:"file_link"`
			FileSize    int64  `json:"file_size"`
			FileBitrate int    `json:"file_bitrate"`
		} `json:"url"`
	} `json:"songurl"`
}

type lyricResponse struct {
	Data struct {
		Lrc string `json:"lrc"`
	} `json:"data"`
}

type songDetailResponse struct {
	Songinfo struct {
		PicRadio string `json:"pic_radio"`
		PicSmall string `json:"pic_small"`
	} `json:"songinfo"`
}

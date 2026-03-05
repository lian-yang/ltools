package musicplayer

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	application "github.com/wailsapp/wails/v3/pkg/application"
)

// ServiceLX 基于 LX Music 的音乐播放器服务（新版本）
type ServiceLX struct {
	plugin        *MusicPlayerPlugin
	app           *application.App
	configManager *ConfigManager
	windowManager *WindowManager

	// LX Music 相关组件
	processManager *ProcessManager
	lxClient       *LXClient
	cacheManager   *CacheManager
	sourceManager  *SourceManager
	proxyHandler   ProxyHandler // 代理处理器

	// 状态
	initialized bool
}

// NewServiceLX 创建基于 LX Music 的服务实例
func NewServiceLX(plugin *MusicPlayerPlugin, app *application.App, proxyHandler ProxyHandler) (*ServiceLX, error) {
	// 初始化配置管理器
	configManager, err := NewConfigManager()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize config manager: %w", err)
	}

	// 初始化窗口管理器
	windowManager := NewWindowManager(plugin, app)

	// 初始化缓存管理器
	cacheManager, err := NewCacheManager(&CacheConfig{
		MemoryCapacity: 1000,
		DefaultTTL:     30 * time.Minute,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache manager: %w", err)
	}

	// 初始化源管理器
	sourceManager := NewSourceManager()

	// 初始化进程管理器
	processManager, err := NewProcessManager(&ProcessManagerConfig{
		NodePath: "node", // 使用系统 Node.js
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize process manager: %w", err)
	}

	service := &ServiceLX{
		plugin:         plugin,
		app:            app,
		configManager:  configManager,
		windowManager:  windowManager,
		processManager: processManager,
		cacheManager:   cacheManager,
		sourceManager:  sourceManager,
		proxyHandler:   proxyHandler,
		initialized:    false,
	}

	// 启动 LX Music 服务进程
	if err := service.startLXService(); err != nil {
		log.Printf("[ServiceLX] Failed to start LX service: %v", err)
		return nil, err
	}

	return service, nil
}

// startLXService 启动 LX Music 服务
func (s *ServiceLX) startLXService() error {
	// 启动进程
	if err := s.processManager.Start(); err != nil {
		return fmt.Errorf("failed to start LX process: %w", err)
	}

	// 创建客户端
	lxClient, err := NewLXClient(s.processManager)
	if err != nil {
		return fmt.Errorf("failed to create LX client: %w", err)
	}
	s.lxClient = lxClient

	// 健康检查
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	health, err := s.lxClient.HealthCheck(ctx)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}

	log.Printf("[ServiceLX] LX service started successfully (uptime: %.1fs, sources: %d)",
		health.Uptime, len(health.Sources))

	s.initialized = true
	return nil
}

// GetWindowManager 获取窗口管理器
func (s *ServiceLX) GetWindowManager() *WindowManager {
	return s.windowManager
}

// Search 搜索歌曲（暴露给前端）
func (s *ServiceLX) Search(keyword string, page int) ([]Song, error) {
	if !s.initialized {
		return nil, fmt.Errorf("service not initialized")
	}

	// 默认页码为 1
	if page < 1 {
		page = 1
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 获取启用的音源
	sources := s.sourceManager.GetEnabledSources()
	if len(sources) == 0 {
		return nil, fmt.Errorf("no enabled sources")
	}

	// 尝试所有音源，直到有一个成功
	var allSongs []Song
	var lastErr error

	for _, source := range sources {
		result, err := s.lxClient.Search(ctx, keyword, source, page, 20)
		if err != nil {
			log.Printf("[ServiceLX] Search failed for source %s: %v", source, err)
			lastErr = err
			continue
		}

		// 转换为内部格式
		for _, lxSong := range result.Songs {
			song := ConvertLXSongToInternal(lxSong)
			allSongs = append(allSongs, song)
		}

		// 如果当前音源返回了结果，直接返回（优先使用第一个成功的音源）
		if len(allSongs) > 0 {
			log.Printf("[ServiceLX] Search completed: keyword=%s, page=%d, source=%s, results=%d", keyword, page, source, len(allSongs))
			return allSongs, nil
		}
	}

	// 所有音源都失败了
	if lastErr != nil {
		return nil, fmt.Errorf("all sources failed: %w", lastErr)
	}

	// 所有音源都没有返回结果
	log.Printf("[ServiceLX] Search completed: keyword=%s, page=%d, results=0", keyword, page)
	return allSongs, nil
}

// GetRandomSong 获取一首随机歌曲（暴露给前端）
func (s *ServiceLX) GetRandomSong() (*Song, error) {
	if !s.initialized {
		return nil, fmt.Errorf("service not initialized")
	}

	// 宽泛关键词列表
	keywords := []string{
		"Dj", "车载", "流行", "经典", "民谣", "摇滚", "电子",
		"轻音乐", "纯音乐", "钢琴", "古风", "爵士", "蓝调",
		"背景音乐", "放松", "抒情", "治愈", "安静", "浪漫",
	}

	// 随机选择关键词
	keywordIndex := time.Now().Unix() % int64(len(keywords))
	keyword := keywords[keywordIndex]

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 获取最佳音源
	source := s.sourceManager.GetBestSource()

	// 搜索
	result, err := s.lxClient.Search(ctx, keyword, source, 1, 10)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	if len(result.Songs) == 0 {
		return nil, fmt.Errorf("no songs found")
	}

	// 返回第一首歌
	song := ConvertLXSongToInternal(result.Songs[0])
	log.Printf("[ServiceLX] Got random song: %s - %v (source: %s)", song.Name, song.Artist, source)

	return &song, nil
}

// GetRandomSongs 获取多首随机歌曲（暴露给前端）
func (s *ServiceLX) GetRandomSongs(count int) ([]Song, error) {
	if !s.initialized {
		return nil, fmt.Errorf("service not initialized")
	}

	// 宽泛关键词列表
	keywords := []string{
		"Dj", "车载", "流行", "经典", "民谣", "摇滚", "电子",
		"轻音乐", "纯音乐", "钢琴", "古风", "爵士", "蓝调",
		"背景音乐", "放松", "抒情", "治愈", "安静", "浪漫",
		"情歌", "热门", "新歌", "网络", "粤语", "英文",
	}

	result := make([]Song, 0, count)
	foundIDs := make(map[string]bool)

	ctx := context.Background()

	// 获取启用的音源
	sources := s.sourceManager.GetEnabledSources()

	// 🔧 Go 1.20+ 不需要手动 Seed，直接使用随机函数
	// 随机起始关键词
	startIndex := rand.Intn(len(keywords))

	// 随机页码（1-5页）
	randomPage := rand.Intn(5) + 1

	keywordIndex := startIndex
	attempts := 0
	maxAttempts := len(keywords) * 2 // 最多尝试关键词数量的2倍

	for len(result) < count && attempts < maxAttempts {
		keyword := keywords[keywordIndex%len(keywords)]
		keywordIndex++
		attempts++

		// 尝试每个音源
		for _, source := range sources {
			if len(result) >= count {
				break
			}

			// 使用随机页码
			page := randomPage
			if attempts > 1 {
				// 第二次及以后，随机切换页码
				page = rand.Intn(5) + 1
			}

			searchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			searchResult, err := s.lxClient.Search(searchCtx, keyword, source, page, 20)
			cancel()

			if err != nil {
				log.Printf("[ServiceLX] Search failed for source %s: %v", source, err)
				continue
			}

			// 检查搜索结果是否为空
			if searchResult == nil || len(searchResult.Songs) == 0 {
				continue
			}

			// 🔧 随机打乱搜索结果，避免每次都返回相同顺序
			songs := searchResult.Songs
			rand.Shuffle(len(songs), func(i, j int) {
				songs[i], songs[j] = songs[j], songs[i]
			})

			// 添加歌曲
			for _, lxSong := range songs {
				if foundIDs[lxSong.ID] {
					continue
				}

				song := ConvertLXSongToInternal(lxSong)
				result = append(result, song)
				foundIDs[lxSong.ID] = true

				if len(result) >= count {
					break
				}
			}
		}
	}

	log.Printf("[ServiceLX] GetRandomSongs: requested=%d, found=%d, startKeyword=%s, page=%d",
		count, len(result), keywords[startIndex], randomPage)

	return result, nil
}

// GetSongURL 获取播放地址（暴露给前端）
func (s *ServiceLX) GetSongURL(id string) (string, error) {
	if !s.initialized {
		return "", fmt.Errorf("service not initialized")
	}

	// 从缓存查找
	cacheKey := GenerateCacheKey("music_url", id, "320k")
	if cached, ok := s.cacheManager.Get(cacheKey); ok {
		if urls, ok := cached.([]SongURLOption); ok && len(urls) > 0 {
			log.Printf("[ServiceLX] Cache hit for song URL: %s", id)
			url := urls[0].URL
			// 确保 HTTPS
			return ensureHTTPS(url), nil
		}
	}

	// 如果缓存未命中，尝试批量获取
	// 这里需要歌曲的元信息，简化版本：直接返回错误
	return "", fmt.Errorf("song URL not in cache, need song metadata")
}

// GetSongURLWithMetadata 使用元数据获取播放地址
func (s *ServiceLX) GetSongURLWithMetadata(song *Song, quality string) (string, error) {
	if !s.initialized {
		return "", fmt.Errorf("service not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 获取启用的音源
	sources := s.sourceManager.GetEnabledSources()

	// 批量获取 URL
	result, err := s.lxClient.GetMusicURLBatch(ctx, song.ID, song.Name, strings.Join(song.Artist, ","),
		song.Duration, sources, quality)
	if err != nil {
		return "", fmt.Errorf("failed to get music URL: %w", err)
	}

	if len(result.URLs) == 0 {
		return "", fmt.Errorf("no available URL")
	}

	// 缓存结果
	cacheKey := GenerateCacheKey("music_url", song.ID, quality)
	s.cacheManager.Set(cacheKey, result.URLs, 30*time.Minute)

	// 🔧 关键修复：优先选择 FLAC 无损格式
	// 格式优先级：FLAC > MP3/AAC/M4A > 其他（跳过不兼容格式）
	var selectedURL *SongURLOption
	var fallbackURL *SongURLOption

	for i := range result.URLs {
		url := &result.URLs[i]
		urlLower := strings.ToLower(url.URL)

		// 跳过不兼容的格式
		// - OGG：Safari 不支持
		// - WMA：浏览器普遍不支持
		// - WAV：文件过大，不适合流式播放
		// - APE：兼容性差
		if strings.Contains(urlLower, ".ogg") ||
			strings.Contains(urlLower, ".wma") ||
			strings.Contains(urlLower, ".wav") ||
			strings.Contains(urlLower, ".ape") {
			log.Printf("[ServiceLX] Skipping incompatible format (%s): %s",
				extractFormat(url.URL), url.URL)
			continue
		}

		// 优先选择 FLAC（无损音质）
		if strings.Contains(urlLower, ".flac") {
			selectedURL = url
			log.Printf("[ServiceLX] Selected FLAC format (lossless quality)")
			break
		}

		// MP3/AAC/M4A 作为备选（兼容性好）
		if (strings.Contains(urlLower, ".mp3") ||
			strings.Contains(urlLower, ".aac") ||
			strings.Contains(urlLower, ".m4a")) && fallbackURL == nil {
			fallbackURL = url
		}

		// 如果还没选中，使用第一个兼容格式
		if selectedURL == nil && fallbackURL == nil {
			fallbackURL = url
		}
	}

	// 选择最终 URL
	if selectedURL == nil {
		selectedURL = fallbackURL
	}

	if selectedURL == nil {
		return "", fmt.Errorf("no compatible audio format available")
	}

	// 返回选中的 URL
	url := selectedURL.URL
	log.Printf("[ServiceLX] Got music URL for song %s from source %s (format: %s): %s",
		song.ID, selectedURL.Source, extractFormat(url), url)

	// 注册到代理服务，返回本地代理 URL
	if s.proxyHandler != nil {
		proxyURL := s.proxyHandler.RegisterAudioURL(song.ID, url)
		log.Printf("[ServiceLX] Proxied audio URL: %s -> %s", url, proxyURL)
		return proxyURL, nil
	}

	return url, nil
}

// GetPicURL 获取封面图片URL（暴露给前端）
func (s *ServiceLX) GetPicURL(picID string) (string, error) {
	// picID 实际上是完整的图片 URL
	if picID == "" {
		return "", nil
	}

	// 注册到代理服务，返回本地代理 URL
	if s.proxyHandler != nil {
		// 使用 URL 的哈希值作为资源 ID
		resourceID := GenerateCacheKey("pic", picID, "")
		proxyURL := s.proxyHandler.RegisterImageURL(resourceID, picID)
		log.Printf("[ServiceLX] Proxied image URL: %s -> %s", picID, proxyURL)
		return proxyURL, nil
	}

	// 直接返回原始 URL（应用已禁用 web 安全）
	return picID, nil
}

// GetLyric 获取歌词（暴露给前端）
func (s *ServiceLX) GetLyric(song Song) (string, error) {
	if !s.initialized {
		return "", fmt.Errorf("service not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 从第一个启用的源获取歌词
	sources := s.sourceManager.GetEnabledSources()
	if len(sources) == 0 {
		return "", fmt.Errorf("no enabled sources")
	}

	// 构造完整的 musicInfo（MusicFree 插件需要完整的歌曲信息）
	musicInfo := map[string]interface{}{
		"id":     song.ID,
		"name":   song.Name,
		"singer": strings.Join(song.Artist, ","),
		"album":  song.Album,
		"source": song.Source,
	}

	lyricResult, err := s.lxClient.GetLyric(ctx, sources[0], musicInfo)
	if err != nil {
		// 静默处理歌词获取失败（某些歌曲没有歌词是正常的）
		return "", nil
	}

	// 返回主歌词
	if lyricResult != nil {
		return lyricResult.Lyric, nil
	}
	return "", nil
}

// 其他方法保持与原 Service 相同

// GetLikeList 获取喜欢列表
func (s *ServiceLX) GetLikeList() ([]Song, error) {
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return nil, err
	}
	return likeList.Songs, nil
}

// AddToLikes 添加到喜欢列表
func (s *ServiceLX) AddToLikes(song Song) error {
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return err
	}

	for _, s := range likeList.Songs {
		if s.ID == song.ID {
			return nil
		}
	}

	likeList.Songs = append(likeList.Songs, song)
	likeList.UpdatedAt = time.Now()

	return s.configManager.SaveLikeList(likeList)
}

// RemoveFromLikes 从喜欢列表移除
func (s *ServiceLX) RemoveFromLikes(id string) error {
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return err
	}

	newSongs := make([]Song, 0)
	for _, song := range likeList.Songs {
		if song.ID != id {
			newSongs = append(newSongs, song)
		}
	}

	likeList.Songs = newSongs
	likeList.UpdatedAt = time.Now()

	return s.configManager.SaveLikeList(likeList)
}

// SetPlatform 切换平台
func (s *ServiceLX) SetPlatform(platform string) error {
	return s.configManager.SetPlatform(platform)
}

// GetPlatform 获取当前平台
func (s *ServiceLX) GetPlatform() string {
	config := s.configManager.GetConfig()
	return config.Platform
}

// SetVolume 设置音量
func (s *ServiceLX) SetVolume(volume int) error {
	return s.configManager.SetVolume(volume)
}

// GetVolume 获取音量
func (s *ServiceLX) GetVolume() int {
	config := s.configManager.GetConfig()
	return config.Volume
}

// ShowWindow 显示窗口
func (s *ServiceLX) ShowWindow() error {
	return s.windowManager.ShowWindow()
}

// HideWindow 隐藏窗口
func (s *ServiceLX) HideWindow() error {
	return s.windowManager.HideWindow()
}

// ToggleWindow 切换窗口
func (s *ServiceLX) ToggleWindow() error {
	return s.windowManager.ToggleWindow()
}

// Close 关闭服务
func (s *ServiceLX) Close() error {
	if s.processManager != nil {
		return s.processManager.Stop()
	}
	return nil
}

// DownloadSong 下载歌曲到指定路径（暴露给前端）
func (s *ServiceLX) DownloadSong(song Song, savePath string) error {
	if !s.initialized {
		return fmt.Errorf("service not initialized")
	}

	// 1. 获取音频 URL
	audioURL, err := s.GetSongURLWithMetadata(&song, "320k")
	if err != nil {
		return fmt.Errorf("failed to get audio URL: %w", err)
	}

	// 2. 如果是代理 URL，获取真实 URL
	if strings.Contains(audioURL, "/proxy/audio/") {
		if s.proxyHandler != nil {
			parts := strings.Split(audioURL, "/")
			if len(parts) > 0 {
				// 提取哈希 ID（URL 最后一段）
				fullID := parts[len(parts)-1]
				// 使用新方法通过哈希 ID 直接获取真实 URL
				realURL := s.proxyHandler.GetURLByFullID(fullID)
				if realURL != "" {
					audioURL = realURL
				}
			}
		}
	}

	// 3. 下载文件
	resp, err := http.Get(audioURL)
	if err != nil {
		return fmt.Errorf("failed to download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// 4. 智能识别格式
	audioFormat := detectAudioFormat(audioURL, resp.Header.Get("Content-Type"))
	actualPath := ensureCorrectExtension(savePath, audioFormat)

	// 5. 创建文件
	outFile, err := os.Create(actualPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	// 6. 写入文件
	_, err = io.Copy(outFile, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to save file: %w", err)
	}

	log.Printf("[ServiceLX] Downloaded song: %s -> %s", song.Name, actualPath)
	return nil
}

// ===== 辅助函数 =====

// ensureHTTPS 确保 URL 使用 HTTPS
func ensureHTTPS(url string) string {
	if strings.HasPrefix(url, "http://") {
		return strings.Replace(url, "http://", "https://", 1)
	}
	return url
}

// extractFormat 从 URL 中提取音频格式
func extractFormat(url string) string {
	urlLower := strings.ToLower(url)

	// 常见音频格式
	formats := []string{
		".flac", ".mp3", ".aac", ".m4a",
		".ogg", ".opus", ".wav", ".ape",
		".wma", ".alac",
	}

	for _, ext := range formats {
		if strings.Contains(urlLower, ext) {
			return strings.TrimPrefix(ext, ".")
		}
	}

	return "unknown"
}

// detectAudioFormat 检测音频格式
func detectAudioFormat(url string, contentType string) string {
	// 优先从 Content-Type 判断
	contentType = strings.ToLower(contentType)
	switch {
	case strings.Contains(contentType, "flac"):
		return "flac"
	case strings.Contains(contentType, "mpeg") || strings.Contains(contentType, "mp3"):
		return "mp3"
	case strings.Contains(contentType, "aac"):
		return "aac"
	case strings.Contains(contentType, "mp4") || strings.Contains(contentType, "m4a"):
		return "m4a"
	}

	// 从 URL 判断
	urlLower := strings.ToLower(url)
	for _, ext := range []string{".flac", ".mp3", ".aac", ".m4a", ".ogg"} {
		if strings.Contains(urlLower, ext) {
			return strings.TrimPrefix(ext, ".")
		}
	}

	return "mp3"
}

// ensureCorrectExtension 确保文件扩展名正确
func ensureCorrectExtension(path string, format string) string {
	ext := filepath.Ext(path)
	correctExt := "." + format

	if ext != correctExt {
		// 移除旧扩展名，添加正确的
		base := strings.TrimSuffix(path, ext)
		return base + correctExt
	}
	return path
}

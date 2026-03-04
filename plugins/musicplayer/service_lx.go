package musicplayer

import (
	"context"
	"fmt"
	"log"
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

	// 状态
	initialized bool
}

// NewServiceLX 创建基于 LX Music 的服务实例
func NewServiceLX(plugin *MusicPlayerPlugin, app *application.App) (*ServiceLX, error) {
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
func (s *ServiceLX) Search(keyword string) ([]Song, error) {
	if !s.initialized {
		return nil, fmt.Errorf("service not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 获取启用的音源
	sources := s.sourceManager.GetEnabledSources()
	if len(sources) == 0 {
		return nil, fmt.Errorf("no enabled sources")
	}

	// 使用第一个音源搜索
	source := sources[0]
	result, err := s.lxClient.Search(ctx, keyword, source, 1, 20)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// 转换为内部格式
	songs := make([]Song, 0, len(result.Songs))
	for _, lxSong := range result.Songs {
		song := ConvertLXSongToInternal(lxSong)
		songs = append(songs, song)
	}

	log.Printf("[ServiceLX] Search completed: keyword=%s, results=%d", keyword, len(songs))
	return songs, nil
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
	}

	result := make([]Song, 0, count)
	foundIDs := make(map[string]bool)

	ctx := context.Background()

	// 获取启用的音源
	sources := s.sourceManager.GetEnabledSources()
	keywordIndex := 0

	for len(result) < count {
		keyword := keywords[keywordIndex%len(keywords)]
		keywordIndex++

		// 尝试每个音源
		for _, source := range sources {
			if len(result) >= count {
				break
			}

			searchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			searchResult, err := s.lxClient.Search(searchCtx, keyword, source, 1, 10)
			cancel()

			if err != nil {
				log.Printf("[ServiceLX] Search failed for source %s: %v", source, err)
				continue
			}

			// 添加歌曲
			for _, lxSong := range searchResult.Songs {
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

		// 避免无限循环
		if keywordIndex > len(keywords)*3 {
			break
		}
	}

	log.Printf("[ServiceLX] Got random songs: %d/%d", len(result), count)
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

	// 返回第一个 URL
	url := result.URLs[0].URL
	log.Printf("[ServiceLX] Got music URL for song %s from source %s: %s", song.ID, result.URLs[0].Source, url)

	return url, nil
}

// GetPicURL 获取封面图片URL（暴露给前端）
func (s *ServiceLX) GetPicURL(picID string) (string, error) {
	// picID 实际上是完整的图片 URL
	if picID == "" {
		return "", nil
	}

	// 直接返回原始 URL（应用已禁用 web 安全）
	return picID, nil
}

// GetLyric 获取歌词（暴露给前端）
func (s *ServiceLX) GetLyric(lyricID string) (string, error) {
	if !s.initialized {
		return "", fmt.Errorf("service not initialized")
	}

	// lyricID 格式：songID
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 从第一个启用的源获取歌词
	sources := s.sourceManager.GetEnabledSources()
	if len(sources) == 0 {
		return "", fmt.Errorf("no enabled sources")
	}

	// 构造基本的 musicInfo
	musicInfo := map[string]interface{}{
		"id": lyricID,
	}

	lyricResult, err := s.lxClient.GetLyric(ctx, sources[0], musicInfo)
	if err != nil {
		log.Printf("[ServiceLX] Failed to get lyric: %v", err)
		return "", nil // 返回空字符串而不是错误，避免阻塞播放
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

// ===== 辅助函数 =====

// ensureHTTPS 确保 URL 使用 HTTPS
func ensureHTTPS(url string) string {
	if strings.HasPrefix(url, "http://") {
		return strings.Replace(url, "http://", "https://", 1)
	}
	return url
}

package musicplayer

import (
	"fmt"
	"log"
	"strings"
	"time"

	application "github.com/wailsapp/wails/v3/pkg/application"
	"ltools/plugins/musicplayer/meting"
)

// Service 音乐播放器服务（暴露给前端）
type Service struct {
	plugin        *MusicPlayerPlugin
	app           *application.App
	configManager *ConfigManager
	meting        *meting.Meting
	metingPool    map[string]*meting.Meting // 多平台实例池
	windowManager *WindowManager            // 添加窗口管理器
	platformOrder []string                  // 平台优先级顺序
}

// NewService 创建服务实例
func NewService(plugin *MusicPlayerPlugin, app *application.App) (*Service, error) {
	// 初始化配置管理器
	configManager, err := NewConfigManager()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize config manager: %w", err)
	}

	// 获取当前平台配置
	config := configManager.GetConfig()

	// 初始化 Meting
	m, err := meting.NewMeting(config.Platform)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize meting: %w", err)
	}

	// 初始化多平台实例池
	metingPool := make(map[string]*meting.Meting)
	metingPool[config.Platform] = m

	// 初始化窗口管理器
	windowManager := NewWindowManager(plugin, app)

	// 平台优先级顺序（腾讯 -> 网易云 -> 酷狗）
	// 注：baidu 和 kuwo 平台 API 不可用，已移除
	platformOrder := []string{"tencent", "netease", "kugou"}

	return &Service{
		plugin:        plugin,
		app:           app,
		configManager: configManager,
		meting:        m,
		metingPool:    metingPool,
		windowManager: windowManager,
		platformOrder: platformOrder,
	}, nil
}

// GetWindowManager 获取窗口管理器（暴露给前端）
func (s *Service) GetWindowManager() *WindowManager {
	return s.windowManager
}

// getMeting 获取或创建指定平台的 Meting 实例
func (s *Service) getMeting(platform string) (*meting.Meting, error) {
	if m, exists := s.metingPool[platform]; exists {
		return m, nil
	}

	// 创建新实例
	m, err := meting.NewMeting(platform)
	if err != nil {
		return nil, err
	}

	s.metingPool[platform] = m
	return m, nil
}

// Search 搜索歌曲（暴露给前端）
// 策略：只返回能获取到播放链接的歌曲
func (s *Service) Search(keyword string) ([]Song, error) {
	// 使用 Meting SDK 搜索
	songs, err := s.meting.Search(keyword)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// 转换为服务层的 Song 类型，并验证播放链接
	result := make([]Song, 0, len(songs))
	for _, song := range songs {
		// 尝试获取播放链接，验证歌曲是否可用
		url, err := s.GetSongURLWithFallback(song.URLID, song.Source)
		if err != nil || url == "" {
			// 无法获取播放链接，跳过此歌曲
			log.Printf("[MusicPlayer] 跳过歌曲 %s - %v (无法获取播放链接: %v)", song.Name, song.Artist, err)
			continue
		}

		// 成功获取播放链接，添加到结果
		result = append(result, Song{
			ID:       song.ID,
			Name:     song.Name,
			Artist:   song.Artist,
			Album:    song.Album,
			PicID:    song.PicID,
			URLID:    song.URLID,
			LyricID:  song.LyricID,
			Source:   song.Source,
			Duration: song.Duration,
		})

		// 限制最多返回10首可用歌曲（避免验证过多）
		if len(result) >= 10 {
			break
		}
	}

	return result, nil
}

// GetRandomSong 获取一首随机歌曲（暴露给前端）
// 用于随机播放器：打开窗口直接播放
// 策略：遍历所有平台，每个平台尝试不同关键词，找到第一首可用的歌曲
func (s *Service) GetRandomSong() (*Song, error) {
	// 宽泛关键词列表（更容易找到免费歌曲）
	keywords := []string{
		// 音乐类型（宽泛）
		"Dj", "车载", "流行", "经典", "民谣", "摇滚", "电子",
		"轻音乐", "纯音乐", "钢琴", "古风", "爵士", "蓝调",
		// 场景/心情
		"背景音乐", "放松", "抒情", "治愈", "安静", "浪漫",
		"睡前", "运动", "跑步", "瑜伽", "学习", "工作",
		// 热门/榜单
		"抖音", "快手", "网红", "翻唱", "原创", "热门",
		// 年代/怀旧
		"80后", "90后", "怀旧", "老歌", "金曲",
		// 地区
		"粤语", "闽南语", "英文", "日文", "韩文",
		// 乐器
		"吉他", "钢琴曲", "小提琴", "萨克斯", "古筝",
	}

	// 随机打乱关键词顺序
	shuffledKeywords := make([]string, len(keywords))
	copy(shuffledKeywords, keywords)
	for i := range shuffledKeywords {
		j := time.Now().UnixNano() % int64(len(shuffledKeywords))
		shuffledKeywords[i], shuffledKeywords[j] = shuffledKeywords[j], shuffledKeywords[i]
	}

	// 遍历所有平台（按照 platformOrder 优先级）
	for _, platform := range s.platformOrder {
		log.Printf("[Service] GetRandomSong: trying platform %s", platform)

		// 获取该平台的 Meting 实例
		m, err := s.getMeting(platform)
		if err != nil {
			log.Printf("[Service] Failed to get meting for platform %s: %v", platform, err)
			continue
		}

		// 尝试最多 3 个不同的关键词
		maxKeywordAttempts := 3
		for attempt := 0; attempt < maxKeywordAttempts; attempt++ {
			keyword := shuffledKeywords[attempt%len(shuffledKeywords)]
			log.Printf("[Service] GetRandomSong: platform=%s, keyword=%s (attempt %d/%d)", platform, keyword, attempt+1, maxKeywordAttempts)

			// 搜索该关键词的歌曲
			songs, err := m.Search(keyword)
			if err != nil {
				log.Printf("[Service] Search failed for platform %s, keyword %s: %v", platform, keyword, err)
				continue
			}

			log.Printf("[Service] Found %d songs for platform %s, keyword %s", len(songs), platform, keyword)

			// 遍历搜索结果，尝试获取播放链接
			maxSongsToTry := 10
			for i := 0; i < len(songs) && i < maxSongsToTry; i++ {
				song := songs[i]

				// 尝试从所有平台获取播放链接（多平台回退）
				url, err := s.GetSongURLWithFallback(song.URLID, platform)
				if err != nil || url == "" {
					log.Printf("[Service] Song %s - %v (index %d) has no valid URL, skipping", song.Name, song.Artist, i)
					continue
				}

				// 成功找到可用歌曲
				log.Printf("[Service] Found valid song: %s - %v (platform: %s, keyword: %s, index: %d)", song.Name, song.Artist, platform, keyword, i)
				result := &Song{
					ID:       song.ID,
					Name:     song.Name,
					Artist:   song.Artist,
					Album:    song.Album,
					PicID:    song.PicID,
					URLID:    song.URLID,
					LyricID:  song.LyricID,
					Source:   song.Source,
					Duration: song.Duration,
				}
				return result, nil
			}

			log.Printf("[Service] No valid songs found for platform %s, keyword %s (tried %d songs)", platform, keyword, min(len(songs), maxSongsToTry))
		}
	}

	return nil, fmt.Errorf("failed to find any available songs after trying all platforms")
}

// min 返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetSongURL 获取播放地址（暴露给前端）
// 实现多平台自动回退：如果当前平台失败，自动尝试其他平台
func (s *Service) GetSongURL(id string) (string, error) {
	return s.GetSongURLWithFallback(id, "")
}

// GetSongURLWithFallback 获取播放地址，支持多平台回退
// preferredPlatform: 优先使用的平台（可选，为空则使用当前配置的平台）
func (s *Service) GetSongURLWithFallback(id string, preferredPlatform string) (string, error) {
	// 确定平台优先级
	platforms := s.platformOrder
	if preferredPlatform != "" {
		// 将优先平台放在第一位
		platforms = make([]string, 0, len(s.platformOrder))
		platforms = append(platforms, preferredPlatform)
		for _, p := range s.platformOrder {
			if p != preferredPlatform {
				platforms = append(platforms, p)
			}
		}
	}

	// 尝试每个平台
	var lastErr error
	for _, platform := range platforms {
		m, err := s.getMeting(platform)
		if err != nil {
			log.Printf("[Service] Failed to get meting for platform %s: %v", platform, err)
			continue
		}

		// 获取播放地址
		songURL, err := m.URL(id, 320)
		if err != nil {
			log.Printf("[Service] Platform %s failed to get URL for song %s: %v", platform, id, err)
			lastErr = err
			continue
		}

		// 检查 URL 是否有效
		if songURL.URL == "" {
			log.Printf("[Service] Platform %s returned empty URL for song %s", platform, id)
			lastErr = fmt.Errorf("empty URL from platform %s", platform)
			continue
		}

		// 🔧 修复 ATS 问题：将 HTTP 转换为 HTTPS
		secureURL := songURL.URL
		if strings.HasPrefix(songURL.URL, "http://") {
			secureURL = strings.Replace(songURL.URL, "http://", "https://", 1)
			log.Printf("[Service] Converted HTTP to HTTPS for ATS compliance")
		}

		log.Printf("[Service] Successfully got URL from platform %s for song %s", platform, id)
		return secureURL, nil
	}

	// 所有平台都失败了
	if lastErr != nil {
		return "", fmt.Errorf("all platforms failed, last error: %w", lastErr)
	}
	return "", fmt.Errorf("all platforms failed to provide URL")
}

// GetRandomSongs 获取多首随机歌曲（暴露给前端）
// 用于预加载队列，提高用户体验
// 策略：遍历所有平台，每个平台尝试不同关键词，收集指定数量的可用歌曲
func (s *Service) GetRandomSongs(count int) ([]Song, error) {
	// 宽泛关键词列表（与 GetRandomSong 相同）
	keywords := []string{
		"Dj", "车载", "流行", "经典", "民谣", "摇滚", "电子",
		"轻音乐", "纯音乐", "钢琴", "古风", "爵士", "蓝调",
		"背景音乐", "放松", "抒情", "治愈", "安静", "浪漫",
		"睡前", "运动", "跑步", "瑜伽", "学习", "工作",
		"抖音", "快手", "网红", "翻唱", "原创", "热门",
		"80后", "90后", "怀旧", "老歌", "金曲",
		"粤语", "闽南语", "英文", "日文", "韩文",
		"吉他", "钢琴曲", "小提琴", "萨克斯", "古筝",
	}

	result := make([]Song, 0, count)
	foundIDs := make(map[string]bool) // 用于去重

	// 随机打乱关键词顺序
	shuffledKeywords := make([]string, len(keywords))
	copy(shuffledKeywords, keywords)
	for i := range shuffledKeywords {
		j := time.Now().UnixNano() % int64(len(shuffledKeywords))
		shuffledKeywords[i], shuffledKeywords[j] = shuffledKeywords[j], shuffledKeywords[i]
	}

	// 遍历所有平台
	keywordIndex := 0
	for _, platform := range s.platformOrder {
		if len(result) >= count {
			break
		}

		log.Printf("[Service] GetRandomSongs: trying platform %s, collected: %d/%d", platform, len(result), count)

		// 获取该平台的 Meting 实例
		m, err := s.getMeting(platform)
		if err != nil {
			log.Printf("[Service] Failed to get meting for platform %s: %v", platform, err)
			continue
		}

		// 尝试多个关键词
		maxKeywordAttempts := 5
		for attempt := 0; attempt < maxKeywordAttempts && len(result) < count; attempt++ {
			keyword := shuffledKeywords[keywordIndex%len(shuffledKeywords)]
			keywordIndex++

			log.Printf("[Service] GetRandomSongs: platform=%s, keyword=%s (attempt %d/%d)", platform, keyword, attempt+1, maxKeywordAttempts)

			// 搜索该关键词的歌曲
			songs, err := m.Search(keyword)
			if err != nil {
				log.Printf("[Service] Search failed for platform %s, keyword %s: %v", platform, keyword, err)
				continue
			}

			// 遍历搜索结果，找到可用的歌曲
			maxSongsToTry := 10
			for i := 0; i < len(songs) && i < maxSongsToTry && len(result) < count; i++ {
				song := songs[i]

				// 去重检查
				if foundIDs[song.ID] {
					continue
				}

				// 尝试从所有平台获取播放链接（多平台回退）
				url, err := s.GetSongURLWithFallback(song.URLID, platform)
				if err != nil || url == "" {
					log.Printf("[Service] Song %s has no valid URL, skipping", song.Name)
					continue
				}

				// 成功找到可用歌曲
				log.Printf("[Service] Found valid song: %s - %v (platform: %s)", song.Name, song.Artist, platform)
				result = append(result, Song{
					ID:       song.ID,
					Name:     song.Name,
					Artist:   song.Artist,
					Album:    song.Album,
					PicID:    song.PicID,
					URLID:    song.URLID,
					LyricID:  song.LyricID,
					Source:   song.Source,
					Duration: song.Duration,
				})
				foundIDs[song.ID] = true
			}
		}

		// 短暂延迟避免请求过快
		time.Sleep(100 * time.Millisecond)
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("failed to find any available songs after trying all platforms")
	}

	log.Printf("[Service] GetRandomSongs completed: collected %d songs", len(result))
	return result, nil
}

// GetLikeList 获取喜欢列表（暴露给前端）
func (s *Service) GetLikeList() ([]Song, error) {
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return nil, err
	}

	return likeList.Songs, nil
}

// AddToLikes 添加到喜欢列表（暴露给前端）
func (s *Service) AddToLikes(song Song) error {
	// 读取现有列表
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return err
	}

	// 检查是否已存在
	for _, s := range likeList.Songs {
		if s.ID == song.ID {
			return nil // 已存在，不重复添加
		}
	}

	// 添加歌曲
	likeList.Songs = append(likeList.Songs, song)
	likeList.UpdatedAt = time.Now()

	// 保存到文件
	return s.configManager.SaveLikeList(likeList)
}

// RemoveFromLikes 从喜欢列表移除（暴露给前端）
func (s *Service) RemoveFromLikes(id string) error {
	// 读取现有列表
	likeList, err := s.configManager.GetLikeList()
	if err != nil {
		return err
	}

	// 过滤掉要删除的歌曲
	newSongs := make([]Song, 0)
	for _, song := range likeList.Songs {
		if song.ID != id {
			newSongs = append(newSongs, song)
		}
	}

	likeList.Songs = newSongs
	likeList.UpdatedAt = time.Now()

	// 保存到文件
	return s.configManager.SaveLikeList(likeList)
}

// SetPlatform 切换平台（暴露给前端）
func (s *Service) SetPlatform(platform string) error {
	// 验证平台是否支持
	supportedPlatforms := []string{"netease", "tencent", "kugou", "baidu", "kuwo"}
	isSupported := false
	for _, p := range supportedPlatforms {
		if p == platform {
			isSupported = true
			break
		}
	}

	if !isSupported {
		return fmt.Errorf("unsupported platform: %s", platform)
	}

	// 获取或创建 Meting 实例
	m, err := s.getMeting(platform)
	if err != nil {
		return fmt.Errorf("failed to get meting for platform %s: %w", platform, err)
	}

	// 更新当前 Meting 实例
	s.meting = m

	// 保存配置
	return s.configManager.SetPlatform(platform)
}

// GetPlatform 获取当前平台（暴露给前端）
func (s *Service) GetPlatform() string {
	config := s.configManager.GetConfig()
	return config.Platform
}

// SetVolume 设置音量（暴露给前端）
func (s *Service) SetVolume(volume int) error {
	return s.configManager.SetVolume(volume)
}

// GetVolume 获取音量（暴露给前端）
func (s *Service) GetVolume() int {
	config := s.configManager.GetConfig()
	return config.Volume
}

// ShowWindow 显示音乐播放器窗口（暴露给前端）
func (s *Service) ShowWindow() error {
	return s.windowManager.ShowWindow()
}

// HideWindow 隐藏音乐播放器窗口（暴露给前端）
func (s *Service) HideWindow() error {
	return s.windowManager.HideWindow()
}

// ToggleWindow 切换窗口显示/隐藏（暴露给前端）
func (s *Service) ToggleWindow() error {
	return s.windowManager.ToggleWindow()
}

// GetPicURL 获取封面图片URL（暴露给前端）
func (s *Service) GetPicURL(picID string) (string, error) {
	if picID == "" {
		return "", fmt.Errorf("pic_id is empty")
	}

	// 调用 meting 获取图片URL
	url, err := s.meting.Pic(picID, 300)
	if err != nil {
		return "", fmt.Errorf("failed to get pic url: %w", err)
	}

	// 确保 HTTPS
	secureURL := url
	if strings.HasPrefix(url, "http://") {
		secureURL = strings.Replace(url, "http://", "https://", 1)
	}

	return secureURL, nil
}

// GetLyric 获取歌词（暴露给前端）
func (s *Service) GetLyric(lyricID string) (string, error) {
	if lyricID == "" {
		return "", fmt.Errorf("lyric_id is empty")
	}

	log.Printf("[Service] GetLyric called with lyricID: %s", lyricID)

	// 调用 meting 获取歌词
	lyric, err := s.meting.Lyric(lyricID)
	if err != nil {
		log.Printf("[Service] Failed to get lyric: %v", err)
		return "", fmt.Errorf("failed to get lyric: %w", err)
	}

	log.Printf("[Service] Got lyric: length=%d, has translation=%v", len(lyric.Lyric), len(lyric.TLyric) > 0)

	// 返回歌词内容（优先返回带翻译的）
	if lyric.TLyric != "" {
		log.Printf("[Service] Returning translated lyric")
		return lyric.TLyric, nil
	}

	log.Printf("[Service] Returning original lyric")
	return lyric.Lyric, nil
}

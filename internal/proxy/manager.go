package proxy

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ResourceType 资源类型
type ResourceType string

const (
	ResourceTypeAudio ResourceType = "audio"
	ResourceTypeImage ResourceType = "image"
	ResourceTypeVideo ResourceType = "video"
	ResourceTypeFile  ResourceType = "file"
)

// ProxyConfig 代理配置
type ProxyConfig struct {
	// 请求超时
	RequestTimeout time.Duration
	// 最大重试次数
	MaxRetries int
	// 是否启用缓存
	EnableCache bool
	// 缓存 TTL
	CacheTTL time.Duration
	// 最大缓存条目数
	MaxCacheEntries int
	// 是否启用日志
	EnableLogging bool
	// 用户代理
	UserAgent string
}

// DefaultProxyConfig 默认配置
func DefaultProxyConfig() *ProxyConfig {
	return &ProxyConfig{
		RequestTimeout:  30 * time.Second,
		MaxRetries:      2,
		EnableCache:     true,
		CacheTTL:        30 * time.Minute,
		MaxCacheEntries: 1000,
		EnableLogging:   true,
		UserAgent:       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	}
}

	// CacheEntry 缓存条目
type CacheEntry struct {
	Data       []byte
	Headers    http.Header
	StatusCode int           // 保存原始状态码
	ExpireTime time.Time
}

// ProxyManager 代理管理器（通用代理服务）
type ProxyManager struct {
	config       *ProxyConfig
	urlMapping   map[string]string // 资源ID -> 远程URL
	metadataMap  map[string]*ResourceMetadata
	cache        map[string]*CacheEntry
	stats        *ProxyStats
	mutex        sync.RWMutex
	cacheMutex   sync.RWMutex
	httpClient   *http.Client
}

// ResourceMetadata 资源元数据
type ResourceMetadata struct {
	ID         string
	Type       ResourceType
	RemoteURL  string
	PluginName string
	CreatedAt  time.Time
	HitCount   int
}

// ProxyStats 代理统计
type ProxyStats struct {
	TotalRequests   int64
	CacheHits       int64
	CacheMisses     int64
	FailedRequests  int64
	TotalBytes      int64
	AverageLatency  time.Duration
	mutex           sync.RWMutex
}

// NewProxyManager 创建代理管理器
func NewProxyManager(config *ProxyConfig) *ProxyManager {
	if config == nil {
		config = DefaultProxyConfig()
	}

	pm := &ProxyManager{
		config:      config,
		urlMapping:  make(map[string]string),
		metadataMap: make(map[string]*ResourceMetadata),
		cache:       make(map[string]*CacheEntry),
		stats:       &ProxyStats{},
		httpClient: &http.Client{
			Timeout: config.RequestTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse // 手动处理重定向
			},
		},
	}

	// 启动缓存清理协程
	if config.EnableCache && config.MaxCacheEntries > 0 {
		go pm.cleanupCache()
	}

	return pm
}

// RegisterResource 注册资源（通用方法）
func (pm *ProxyManager) RegisterResource(resourceType ResourceType, pluginName, resourceID, remoteURL string) string {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// 生成完整的资源 ID（带命名空间）
	fullID := pm.generateResourceID(resourceType, pluginName, resourceID)

	// 存储 URL 映射
	pm.urlMapping[fullID] = remoteURL

	// 存储元数据
	pm.metadataMap[fullID] = &ResourceMetadata{
		ID:         fullID,
		Type:       resourceType,
		RemoteURL:  remoteURL,
		PluginName: pluginName,
		CreatedAt:  time.Now(),
		HitCount:   0,
	}

	if pm.config.EnableLogging {
		log.Printf("[ProxyManager] Registered %s resource: [%s] %s -> %s",
			resourceType, pluginName, resourceID, remoteURL)
	}

	// 返回代理 URL
	return pm.getProxyURL(resourceType, fullID)
}

// RegisterAudio 注册音频资源（便捷方法）
func (pm *ProxyManager) RegisterAudio(pluginName, resourceID, remoteURL string) string {
	return pm.RegisterResource(ResourceTypeAudio, pluginName, resourceID, remoteURL)
}

// RegisterImage 注册图片资源（便捷方法）
func (pm *ProxyManager) RegisterImage(pluginName, resourceID, remoteURL string) string {
	return pm.RegisterResource(ResourceTypeImage, pluginName, resourceID, remoteURL)
}

// RegisterVideo 注册视频资源（便捷方法）
func (pm *ProxyManager) RegisterVideo(pluginName, resourceID, remoteURL string) string {
	return pm.RegisterResource(ResourceTypeVideo, pluginName, resourceID, remoteURL)
}

// RegisterFile 注册文件资源（便捷方法）
func (pm *ProxyManager) RegisterFile(pluginName, resourceID, remoteURL string) string {
	return pm.RegisterResource(ResourceTypeFile, pluginName, resourceID, remoteURL)
}

// GetResourceURL 获取资源的远程 URL
func (pm *ProxyManager) GetResourceURL(resourceType ResourceType, pluginName, resourceID string) string {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	fullID := pm.generateResourceID(resourceType, pluginName, resourceID)
	return pm.urlMapping[fullID]
}

// GetAudioURL 获取音频资源的远程 URL（便捷方法）
func (pm *ProxyManager) GetAudioURL(pluginName, resourceID string) string {
	return pm.GetResourceURL(ResourceTypeAudio, pluginName, resourceID)
}

// GetURLByFullID 通过完整的资源 ID（哈希值）直接获取 URL
// 用于下载等场景，只有哈希 ID 而不知道原始 resourceID
func (pm *ProxyManager) GetURLByFullID(fullID string) string {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()
	return pm.urlMapping[fullID]
}

// UnregisterResource 注销资源
func (pm *ProxyManager) UnregisterResource(resourceType ResourceType, pluginName, resourceID string) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	fullID := pm.generateResourceID(resourceType, pluginName, resourceID)
	delete(pm.urlMapping, fullID)
	delete(pm.metadataMap, fullID)

	// 清理缓存
	pm.cacheMutex.Lock()
	delete(pm.cache, fullID)
	pm.cacheMutex.Unlock()

	if pm.config.EnableLogging {
		log.Printf("[ProxyManager] Unregistered resource: %s", fullID)
	}
}

// UnregisterPlugin 注销插件的所有资源
func (pm *ProxyManager) UnregisterPlugin(pluginName string) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// 查找并删除该插件的所有资源
	for fullID, metadata := range pm.metadataMap {
		if metadata.PluginName == pluginName {
			delete(pm.urlMapping, fullID)
			delete(pm.metadataMap, fullID)

			// 清理缓存
			pm.cacheMutex.Lock()
			delete(pm.cache, fullID)
			pm.cacheMutex.Unlock()
		}
	}

	if pm.config.EnableLogging {
		log.Printf("[ProxyManager] Unregistered all resources for plugin: %s", pluginName)
	}
}

// ServeHTTP 实现 http.Handler 接口
func (pm *ProxyManager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 处理 OPTIONS 预检请求
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*") // 允许所有请求头
		w.Header().Set("Access-Control-Max-Age", "86400")   // 24 小时
		w.WriteHeader(http.StatusOK)
		return
	}

	// 检查是否是代理请求
	for _, prefix := range []string{"/proxy/audio/", "/proxy/image/", "/proxy/video/", "/proxy/file/"} {
		if strings.HasPrefix(path, prefix) {
			resourceType := strings.TrimPrefix(prefix, "/proxy/")
			resourceType = strings.TrimSuffix(resourceType, "/")
			pm.handleProxy(w, r, path, ResourceType(resourceType))
			return
		}
	}

	// 不是代理请求，返回 404
	http.NotFound(w, r)
}

// handleProxy 处理代理请求
func (pm *ProxyManager) handleProxy(w http.ResponseWriter, r *http.Request, path string, resourceType ResourceType) {
	startTime := time.Now()

	// 更新统计
	pm.stats.mutex.Lock()
	pm.stats.TotalRequests++
	pm.stats.mutex.Unlock()

	// 获取资源 ID（需要 URL 解码以处理空格等特殊字符）
	encodedResourceID := strings.TrimPrefix(path, fmt.Sprintf("/proxy/%s/", resourceType))
	resourceID, err := url.PathUnescape(encodedResourceID)
	if err != nil {
		pm.stats.mutex.Lock()
		pm.stats.FailedRequests++
		pm.stats.mutex.Unlock()

		http.Error(w, "Invalid resource ID encoding", http.StatusBadRequest)
		if pm.config.EnableLogging {
			log.Printf("[ProxyManager] Failed to decode resource ID: %s, error: %v", encodedResourceID, err)
		}
		return
	}

	pm.mutex.RLock()
	remoteURL, ok := pm.urlMapping[resourceID]
	metadata := pm.metadataMap[resourceID]
	pm.mutex.RUnlock()

	if !ok {
		pm.stats.mutex.Lock()
		pm.stats.FailedRequests++
		pm.stats.mutex.Unlock()

		http.Error(w, "Resource not found", http.StatusNotFound)
		if pm.config.EnableLogging {
			log.Printf("[ProxyManager] Resource not found: %s", resourceID)
		}
		return
	}

	// 更新元数据
	if metadata != nil {
		pm.mutex.Lock()
		metadata.HitCount++
		pm.mutex.Unlock()
	}

	// 检查缓存
	if pm.config.EnableCache {
		pm.cacheMutex.RLock()
		cached, found := pm.cache[resourceID]
		pm.cacheMutex.RUnlock()

		if found && time.Now().Before(cached.ExpireTime) {
			pm.serveFromCache(w, r, cached)

			// 更新统计
			pm.stats.mutex.Lock()
			pm.stats.CacheHits++
			pm.stats.TotalBytes += int64(len(cached.Data))
			pm.stats.mutex.Unlock()

			if pm.config.EnableLogging {
				log.Printf("[ProxyManager] Cache hit: %s (%d bytes)", resourceID, len(cached.Data))
			}
			return
		}
	}

	// 缓存未命中，代理请求
	pm.stats.mutex.Lock()
	pm.stats.CacheMisses++
	pm.stats.mutex.Unlock()

	// 代理请求（带重试）
	var resp *http.Response
	var proxyErr error

	for retry := 0; retry <= pm.config.MaxRetries; retry++ {
		resp, proxyErr = pm.proxyRequest(r, remoteURL)
		if proxyErr == nil {
			break
		}

		if retry < pm.config.MaxRetries && pm.config.EnableLogging {
			log.Printf("[ProxyManager] Retry %d/%d for %s: %v", retry+1, pm.config.MaxRetries, resourceID, proxyErr)
		}
	}

	if proxyErr != nil {
		pm.stats.mutex.Lock()
		pm.stats.FailedRequests++
		pm.stats.mutex.Unlock()

		http.Error(w, "Failed to fetch resource", http.StatusBadGateway)
		if pm.config.EnableLogging {
			log.Printf("[ProxyManager] Failed to proxy: %v", proxyErr)
		}
		return
	}
	defer resp.Body.Close()

	// 处理响应
	pm.serveResponse(w, r, resp, resourceID, resourceType, remoteURL)

	// 更新延迟统计
	latency := time.Since(startTime)
	pm.stats.mutex.Lock()
	// 简单的移动平均
	pm.stats.AverageLatency = (pm.stats.AverageLatency + latency) / 2
	pm.stats.mutex.Unlock()
}

// proxyRequest 执行代理请求
func (pm *ProxyManager) proxyRequest(r *http.Request, remoteURL string) (*http.Response, error) {
	// 创建代理请求
	proxyReq, err := http.NewRequest(r.Method, remoteURL, nil)
	if err != nil {
		return nil, err
	}

	// 复制请求头
	for key, values := range r.Header {
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// 设置 User-Agent
	proxyReq.Header.Set("User-Agent", pm.config.UserAgent)

	// 发送请求
	resp, err := pm.httpClient.Do(proxyReq)
	if err != nil {
		return nil, err
	}

	// 处理重定向
	if resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusMovedPermanently {
		location := resp.Header.Get("Location")
		if location != "" {
			resp.Body.Close()
			return pm.proxyRequest(r, location)
		}
	}

	return resp, nil
}

// serveResponse 处理并缓存响应
func (pm *ProxyManager) serveResponse(w http.ResponseWriter, r *http.Request, resp *http.Response, resourceID string, resourceType ResourceType, remoteURL string) {
	// 检查状态码
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		http.Error(w, fmt.Sprintf("Server returned status %d", resp.StatusCode), resp.StatusCode)
		return
	}

	// 读取响应体（如果启用缓存）
	// 注意：对于音频和视频，不缓存（因为 Range 请求复杂）
	var bodyData []byte
	var err error

	shouldCache := pm.config.EnableCache &&
		resp.StatusCode == http.StatusOK &&
		resourceType != ResourceTypeAudio &&
		resourceType != ResourceTypeVideo

	if shouldCache {
		bodyData, err = io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, "Failed to read response", http.StatusInternalServerError)
			return
		}

		// 缓存响应（包括状态码）
		pm.cacheMutex.Lock()
		pm.cache[resourceID] = &CacheEntry{
			Data:       bodyData,
			Headers:    resp.Header,
			StatusCode: resp.StatusCode,
			ExpireTime: time.Now().Add(pm.config.CacheTTL),
		}
		pm.cacheMutex.Unlock()

		// 更新统计
		pm.stats.mutex.Lock()
		pm.stats.TotalBytes += int64(len(bodyData))
		pm.stats.mutex.Unlock()
	}

	// 复制响应头
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// 🔧 关键修复：对于音频和视频，添加 Accept-Ranges 头
	// 某些浏览器需要这个头来确认服务器支持 Range 请求
	if resourceType == ResourceTypeAudio || resourceType == ResourceTypeVideo {
		if w.Header().Get("Accept-Ranges") == "" {
			w.Header().Set("Accept-Ranges", "bytes")
		}

		// 🔧 规范化音频 MIME 类型：Safari 可能不认识某些非标准 MIME 类型
		contentType := w.Header().Get("Content-Type")
		normalized := false

		// 如果是通用二进制流，根据 URL 推断 MIME 类型
		if contentType == "application/octet-stream" || contentType == "" {
			// 从 URL 中提取文件扩展名
			urlLower := strings.ToLower(remoteURL)
			switch {
			case strings.Contains(urlLower, ".flac"):
				w.Header().Set("Content-Type", "audio/flac")
				normalized = true
			case strings.Contains(urlLower, ".mp3"):
				w.Header().Set("Content-Type", "audio/mpeg")
				normalized = true
			case strings.Contains(urlLower, ".m4a"):
				w.Header().Set("Content-Type", "audio/mp4")
				normalized = true
			case strings.Contains(urlLower, ".aac"):
				w.Header().Set("Content-Type", "audio/aac")
				normalized = true
			case strings.Contains(urlLower, ".ogg"):
				w.Header().Set("Content-Type", "audio/ogg")
				normalized = true
			case strings.Contains(urlLower, ".wav"):
				w.Header().Set("Content-Type", "audio/wav")
				normalized = true
			}
		} else {
			// 规范化已知的非标准 MIME 类型
			switch contentType {
			case "audio/x-flac":
				w.Header().Set("Content-Type", "audio/flac")
				normalized = true
			case "audio/x-ogg", "application/ogg":
				w.Header().Set("Content-Type", "audio/ogg")
				normalized = true
			case "audio/x-vorbis":
				w.Header().Set("Content-Type", "audio/vorbis")
				normalized = true
			}
		}

		if normalized && pm.config.EnableLogging {
			log.Printf("[ProxyManager] Normalized MIME type: %s -> %s", contentType, w.Header().Get("Content-Type"))
		}
	}

	// 添加 CORS 头（宽松配置，支持通用场景）
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")                                                                                         // 允许所有请求头
	w.Header().Set("Access-Control-Expose-Headers", "*")                                                                                       // 暴露所有响应头
	w.Header().Set("Access-Control-Max-Age", "86400")                                                                                          // 24小时缓存

	// 写入响应状态码
	w.WriteHeader(resp.StatusCode)

	// 写入响应体
	if bodyData != nil {
		w.Write(bodyData)
	} else {
		// 流式传输（不缓存）
		written, err := io.Copy(w, resp.Body)
		if err != nil && !isBrokenPipeError(err) {
			log.Printf("[ProxyManager] Failed to write response: %v", err)
			return
		}

		// 更新统计
		pm.stats.mutex.Lock()
		pm.stats.TotalBytes += written
		pm.stats.mutex.Unlock()
	}

	if pm.config.EnableLogging {
		log.Printf("[ProxyManager] Proxied: %s (status: %d)", resourceID, resp.StatusCode)
	}
}

// serveFromCache 从缓存提供响应
func (pm *ProxyManager) serveFromCache(w http.ResponseWriter, r *http.Request, cached *CacheEntry) {
	// 复制响应头
	for key, values := range cached.Headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// 添加 CORS 头（宽松配置，支持通用场景）
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Expose-Headers", "*")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.Header().Set("X-Cache", "HIT")

	w.WriteHeader(cached.StatusCode)
	w.Write(cached.Data)
}

// cleanupCache 定期清理过期缓存
func (pm *ProxyManager) cleanupCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		pm.cacheMutex.Lock()

		now := time.Now()
		for id, entry := range pm.cache {
			if now.After(entry.ExpireTime) {
				delete(pm.cache, id)
			}
		}

		// 如果超过最大条目数，使用 LRU 策略清理
		if len(pm.cache) > pm.config.MaxCacheEntries {
			// 简单实现：删除最旧的 10%
			toDelete := len(pm.cache) - pm.config.MaxCacheEntries + pm.config.MaxCacheEntries/10
			if toDelete > 0 {
				// 根据元数据中的访问次数排序，删除访问次数最少的
				// 这里简化处理，直接删除最早的条目
				count := 0
				for id := range pm.cache {
					if count >= toDelete {
						break
					}
					delete(pm.cache, id)
					count++
				}
			}
		}

		pm.cacheMutex.Unlock()

		if pm.config.EnableLogging {
			log.Printf("[ProxyManager] Cache cleanup: %d entries", len(pm.cache))
		}
	}
}

// generateResourceID 生成资源 ID
func (pm *ProxyManager) generateResourceID(resourceType ResourceType, pluginName, resourceID string) string {
	// 使用哈希确保 ID 唯一且长度固定
	hash := md5.Sum([]byte(fmt.Sprintf("%s:%s:%s", resourceType, pluginName, resourceID)))
	return hex.EncodeToString(hash[:])
}

// getProxyURL 获取代理 URL
func (pm *ProxyManager) getProxyURL(resourceType ResourceType, fullID string) string {
	return fmt.Sprintf("/proxy/%s/%s", resourceType, fullID)
}

// GetStats 获取统计信息
func (pm *ProxyManager) GetStats() map[string]interface{} {
	pm.stats.mutex.RLock()
	defer pm.stats.mutex.RUnlock()

	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	pm.cacheMutex.RLock()
	defer pm.cacheMutex.RUnlock()

	return map[string]interface{}{
		"total_requests":   pm.stats.TotalRequests,
		"cache_hits":       pm.stats.CacheHits,
		"cache_misses":     pm.stats.CacheMisses,
		"failed_requests":  pm.stats.FailedRequests,
		"total_bytes":      pm.stats.TotalBytes,
		"average_latency":  pm.stats.AverageLatency.String(),
		"registered_resources": len(pm.urlMapping),
		"cache_entries":    len(pm.cache),
		"hit_rate":         float64(pm.stats.CacheHits) / float64(pm.stats.TotalRequests) * 100,
	}
}

// ClearCache 清空缓存
func (pm *ProxyManager) ClearCache() {
	pm.cacheMutex.Lock()
	defer pm.cacheMutex.Unlock()

	pm.cache = make(map[string]*CacheEntry)

	if pm.config.EnableLogging {
		log.Printf("[ProxyManager] Cache cleared")
	}
}

// isBrokenPipeError 检查是否是客户端断开连接的错误（正常的网络中断）
func isBrokenPipeError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "broken pipe") ||
		strings.Contains(errMsg, "connection reset by peer") ||
		strings.Contains(errMsg, "request has been stopped") || // 客户端主动取消请求
		strings.Contains(errMsg, "client disconnected") ||
		strings.Contains(errMsg, "context canceled")
}

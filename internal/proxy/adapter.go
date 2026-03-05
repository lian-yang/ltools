package proxy

// MusicPlayerAdapter 适配器，让 ProxyManager 兼容 musicplayer 的 ProxyHandler 接口
type MusicPlayerAdapter struct {
	manager  *ProxyManager
	pluginName string
}

// NewMusicPlayerAdapter 创建适配器
func NewMusicPlayerAdapter(manager *ProxyManager) *MusicPlayerAdapter {
	return &MusicPlayerAdapter{
		manager:    manager,
		pluginName: "musicplayer",
	}
}

// RegisterAudioURL 注册音频 URL（实现 musicplayer.ProxyHandler 接口）
// 返回代理 URL
func (a *MusicPlayerAdapter) RegisterAudioURL(resourceID, remoteURL string) string {
	return a.manager.RegisterAudio(a.pluginName, resourceID, remoteURL)
}

// RegisterImageURL 注册图片 URL（实现 musicplayer.ProxyHandler 接口）
// 返回代理 URL
func (a *MusicPlayerAdapter) RegisterImageURL(resourceID, remoteURL string) string {
	return a.manager.RegisterImage(a.pluginName, resourceID, remoteURL)
}

// GetAudioURL 获取音频的真实 URL（实现 musicplayer.ProxyHandler 接口）
func (a *MusicPlayerAdapter) GetAudioURL(resourceID string) string {
	return a.manager.GetAudioURL(a.pluginName, resourceID)
}

// GetURLByFullID 通过完整的资源 ID（哈希值）直接获取 URL（实现 musicplayer.ProxyHandler 接口）
func (a *MusicPlayerAdapter) GetURLByFullID(fullID string) string {
	return a.manager.GetURLByFullID(fullID)
}

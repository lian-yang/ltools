package musicplayer

// ProxyHandler 代理处理器接口
// 用于将音频和图片 URL 注册到 Wails Assets Server 的代理映射中
type ProxyHandler interface {
	// RegisterAudioURL 注册音频 URL
	// resourceID: 资源唯一标识（通常是歌曲ID或哈希值）
	// remoteURL: 远程音频 URL
	// 返回: 代理 URL（如 /proxy/audio/<hash>）
	RegisterAudioURL(resourceID, remoteURL string) string

	// RegisterImageURL 注册图片 URL
	// resourceID: 资源唯一标识（通常是图片ID或哈希值）
	// remoteURL: 远程图片 URL
	// 返回: 代理 URL（如 /proxy/image/<hash>）
	RegisterImageURL(resourceID, remoteURL string) string

	// GetAudioURL 获取音频的真实 URL
	// resourceID: 资源唯一标识
	// 返回: 远程音频 URL（如果不存在则返回空字符串）
	GetAudioURL(resourceID string) string

	// GetURLByFullID 通过完整的资源 ID（哈希值）直接获取 URL
	// 用于下载等场景，只有哈希 ID 而不知道原始 resourceID
	// fullID: 完整的资源 ID（哈希值）
	// 返回: 远程 URL（如果不存在则返回空字符串）
	GetURLByFullID(fullID string) string
}

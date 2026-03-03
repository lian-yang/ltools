package meting

// Platform 音乐平台接口
type Platform interface {
	// Search 搜索歌曲
	Search(keyword string, page, limit int) ([]Song, error)

	// Song 获取歌曲详情
	Song(id string) (*Song, error)

	// URL 获取播放地址
	URL(id string, bitrate int) (*SongURL, error)

	// Lyric 获取歌词
	Lyric(id string) (*Lyric, error)

	// Pic 获取封面图片地址
	Pic(id string, size int) (string, error)

	// Album 获取专辑信息
	Album(id string) (*Album, error)

	// Artist 获取歌手信息
	Artist(id string, limit int) (*Artist, error)

	// Playlist 获取歌单（如果支持）
	Playlist(id string) ([]Song, error)

	// Name 返回平台名称
	Name() string
}

package netease

// API 端点定义
const (
	// BaseURL 网易云音乐 API 基础 URL
	BaseURL = "https://music.163.com"

	// SearchAPI 搜索接口
	SearchAPI = BaseURL + "/api/cloudsearch/pc"

	// SongDetailAPI 歌曲详情接口
	SongDetailAPI = BaseURL + "/api/v3/song/detail/"

	// SongURLAPI 歌曲播放地址接口
	SongURLAPI = BaseURL + "/api/song/enhance/player/url"

	// LyricAPI 歌词接口
	LyricAPI = BaseURL + "/api/song/lyric"

	// AlbumAPI 专辑接口
	AlbumAPI = BaseURL + "/api/v1/album/"

	// ArtistAPI 歌手接口
	ArtistAPI = BaseURL + "/api/v1/artist/"

	// PlaylistAPI 歌单接口
	PlaylistAPI = BaseURL + "/api/v6/playlist/detail"

	// PicAPI 封面图片接口（直接拼接）
	PicAPITemplate = "https://p3.music.126.net/%s/%s.jpg"
)

// API 参数常量
const (
	// SearchType 搜索类型
	SearchTypeSong     = 1 // 单曲
	SearchTypeAlbum    = 10 // 专辑
	SearchTypeArtist   = 100 // 歌手
	SearchTypePlaylist = 1000 // 歌单
	SearchTypeUser     = 1002 // 用户
	SearchTypeMV       = 1004 // MV
	SearchTypeLyric    = 1006 // 歌词
	SearchTypeRadio    = 1009 // 电台
)

// 默认参数
const (
	DefaultSearchLimit = 30
	DefaultBitrate     = 320000 // 320kbps
	DefaultPicSize     = 300
)

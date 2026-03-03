package musicplayer

import "time"

// Song 歌曲信息
type Song struct {
	ID       string   `json:"id"`        // 歌曲 ID
	Name     string   `json:"name"`      // 歌曲名
	Artist   []string `json:"artist"`    // 歌手列表
	Album    string   `json:"album"`     // 专辑名
	PicID    string   `json:"pic_id"`    // 封面 ID
	URLID    string   `json:"url_id"`    // 播放 URL ID
	LyricID  string   `json:"lyric_id"`  // 歌词 ID
	Source   string   `json:"source"`    // 来源平台 (netease/tencent/kugou等)
	Duration int      `json:"duration"`  // 时长（秒）
}

// SongURL 播放地址信息
type SongURL struct {
	URL     string `json:"url"`      // 播放地址
	Size    int64  `json:"size"`     // 文件大小
	Bitrate int    `json:"bitrate"`  // 码率
}

// Config 播放器配置
type Config struct {
	Platform string `json:"platform"`  // 当前平台 (netease/tencent/kugou等)
	Volume   int    `json:"volume"`    // 音量 (0-100)
}

// LikeList 喜欢列表
type LikeList struct {
	Songs     []Song    `json:"songs"`
	UpdatedAt time.Time `json:"updated_at"`
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
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Pic    string   `json:"pic"`
	Albums []Album  `json:"albums"`
}

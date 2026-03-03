package meting

import (
	"ltools/plugins/musicplayer/meting/kugou"
)

// KugouAdapter 酷狗音乐适配器
type KugouAdapter struct {
	platform *kugou.KugouPlatform
}

// newKugouAdapter 创建酷狗音乐适配器
func newKugouAdapter() *KugouAdapter {
	return &KugouAdapter{
		platform: kugou.NewKugouPlatform(),
	}
}

// Search 搜索歌曲
func (a *KugouAdapter) Search(keyword string, page, limit int) ([]Song, error) {
	songs, err := a.platform.Search(keyword, page, limit)
	if err != nil {
		return nil, err
	}

	// 转换为标准 Song 类型
	result := make([]Song, 0, len(songs))
	for _, song := range songs {
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
	}

	return result, nil
}

// Song 获取歌曲详情
func (a *KugouAdapter) Song(id string) (*Song, error) {
	song, err := a.platform.Song(id)
	if err != nil {
		return nil, err
	}

	return &Song{
		ID:       song.ID,
		Name:     song.Name,
		Artist:   song.Artist,
		Album:    song.Album,
		PicID:    song.PicID,
		URLID:    song.URLID,
		LyricID:  song.LyricID,
		Source:   song.Source,
		Duration: song.Duration,
	}, nil
}

// URL 获取播放地址
func (a *KugouAdapter) URL(id string, bitrate int) (*SongURL, error) {
	url, err := a.platform.URL(id, bitrate)
	if err != nil {
		return nil, err
	}

	return &SongURL{
		URL:     url.URL,
		Size:    url.Size,
		Bitrate: url.Bitrate,
	}, nil
}

// Lyric 获取歌词
func (a *KugouAdapter) Lyric(id string) (*Lyric, error) {
	lyric, err := a.platform.Lyric(id)
	if err != nil {
		return nil, err
	}

	return &Lyric{
		Lyric:  lyric.Lyric,
		TLyric: lyric.TLyric,
	}, nil
}

// Pic 获取封面图片地址
func (a *KugouAdapter) Pic(id string, size int) (string, error) {
	return a.platform.Pic(id, size)
}

// Album 获取专辑信息
func (a *KugouAdapter) Album(id string) (*Album, error) {
	album, err := a.platform.Album(id)
	if err != nil {
		return nil, err
	}

	return &Album{
		ID:     album.ID,
		Name:   album.Name,
		Artist: album.Artist,
		Pic:    album.Pic,
	}, nil
}

// Artist 获取歌手信息
func (a *KugouAdapter) Artist(id string, limit int) (*Artist, error) {
	artist, err := a.platform.Artist(id, limit)
	if err != nil {
		return nil, err
	}

	albums := make([]Album, 0, len(artist.Albums))
	for _, album := range artist.Albums {
		albums = append(albums, Album{
			ID:     album.ID,
			Name:   album.Name,
			Artist: album.Artist,
			Pic:    album.Pic,
		})
	}

	return &Artist{
		ID:     artist.ID,
		Name:   artist.Name,
		Pic:    artist.Pic,
		Albums: albums,
	}, nil
}

// Playlist 获取歌单
func (a *KugouAdapter) Playlist(id string) ([]Song, error) {
	songs, err := a.platform.Playlist(id)
	if err != nil {
		return nil, err
	}

	result := make([]Song, 0, len(songs))
	for _, song := range songs {
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
	}

	return result, nil
}

// Name 返回平台名称
func (a *KugouAdapter) Name() string {
	return a.platform.Name()
}

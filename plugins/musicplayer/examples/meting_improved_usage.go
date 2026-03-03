package main

import (
	"fmt"
	"ltools/plugins/musicplayer/meting"
	"time"
)

func main() {
	fmt.Println("=== Meting Go 版本改进示例 ===")
	fmt.Println()

	// 示例 1: 链式 API（类似 Meting JS）
	fmt.Println("1. 链式 API 调用:")
	m, err := meting.NewMeting("netease")
	if err != nil {
		panic(err)
	}

	// 链式配置
	songs, err := m.
		Format(true).
		Cookie("your_cookie_here").
		Timeout(10 * time.Second).
		Retries(3).
		Search("Hello Adele",
			meting.WithType(meting.SearchTypeSong),
			meting.WithPage(1),
			meting.WithLimit(10),
		)

	if err != nil {
		// 检查是否是 MetingError
		if metingErr, ok := err.(*meting.MetingError); ok {
			fmt.Printf("错误详情:\n")
			fmt.Printf("  平台: %s\n", metingErr.Platform)
			fmt.Printf("  方法: %s\n", metingErr.Method)
			fmt.Printf("  消息: %s\n", metingErr.Message)
			fmt.Printf("  原始错误: %v\n", metingErr.Original)
		} else {
			fmt.Printf("搜索失败: %v\n", err)
		}
		return
	}

	fmt.Printf("找到 %d 首歌曲\n", len(songs))
	if len(songs) > 0 {
		song := songs[0]
		fmt.Printf("\n第一首歌曲:\n")
		fmt.Printf("  ID: %s\n", song.ID)
		fmt.Printf("  名称: %s\n", song.Name)
		fmt.Printf("  艺术家: %v\n", song.Artist)
		fmt.Printf("  专辑: %s\n", song.Album)
		fmt.Printf("  来源: %s\n", song.Source)

		// 示例 2: 获取播放地址（带错误处理）
		fmt.Println("\n2. 获取播放地址:")
		url, err := m.URL(song.URLID, 320)
		if err != nil {
			if metingErr, ok := err.(*meting.MetingError); ok {
				fmt.Printf("获取播放地址失败 [%s:%s]: %s\n",
					metingErr.Platform, metingErr.Method, metingErr.Message)
			} else {
				fmt.Printf("获取播放地址失败: %v\n", err)
			}
		} else {
			fmt.Printf("  播放地址: %s\n", url.URL)
			fmt.Printf("  码率: %d kbps\n", url.Bitrate)
			fmt.Printf("  文件大小: %d bytes\n", url.Size)
		}

		// 示例 3: 获取歌词
		fmt.Println("\n3. 获取歌词:")
		lyric, err := m.Lyric(song.LyricID)
		if err != nil {
			fmt.Printf("获取歌词失败: %v\n", err)
		} else {
			fmt.Printf("  歌词长度: %d 字符\n", len(lyric.Lyric))
			if len(lyric.TLyric) > 0 {
				fmt.Printf("  翻译长度: %d 字符\n", len(lyric.TLyric))
			}
		}

		// 示例 4: 获取封面图片
		fmt.Println("\n4. 获取封面图片:")
		picURL, err := m.Pic(song.PicID, 300)
		if err != nil {
			fmt.Printf("获取封面失败: %v\n", err)
		} else {
			fmt.Printf("  封面地址: %s\n", picURL)
		}
	}

	// 示例 5: 不同平台切换
	fmt.Println("\n5. 切换到腾讯音乐:")
	m2, err := meting.NewMeting("tencent")
	if err != nil {
		fmt.Printf("创建腾讯音乐实例失败: %v\n", err)
	} else {
		songs2, err := m2.
			Format(true).
			Timeout(15 * time.Second).
			Search("周杰伦", meting.WithLimit(5))

		if err != nil {
			fmt.Printf("腾讯音乐搜索失败: %v\n", err)
		} else {
			fmt.Printf("腾讯音乐找到 %d 首歌曲\n", len(songs2))
		}
	}

	// 示例 6: 搜索类型（未来支持）
	fmt.Println("\n6. 搜索类型（未来支持）:")
	_, err = m.Search("周杰伦",
		meting.WithType(meting.SearchTypeAlbum), // 搜索专辑（暂不支持）
		meting.WithLimit(10),
	)
	if err != nil {
		if metingErr, ok := err.(*meting.MetingError); ok {
				fmt.Printf("预期的错误: %s\n", metingErr.Message)
		}
	}

	fmt.Println("\n=== 示例完成 ===")
}

package main

import (
	"fmt"
	"ltools/plugins/musicplayer/meting"
	"time"
)

func main() {
	fmt.Println("=== Meting Go 基础测试 ===")

	platforms := []string{"kugou"} // "netease", "tencent", "kugou", "baidu", "kuwo"
	testKeyword := "米店"

	for _, platform := range platforms {
		fmt.Printf("\n--- 测试平台: %s ---\n", platform)

		// 创建 Meting 实例
		m, err := meting.NewMeting(platform)
		if err != nil {
			fmt.Printf("✗ 创建实例失败: %v\n", err)
			continue
		}

		// 启用格式化
		m.Format(true)

		// 测试搜索功能
		fmt.Println("测试搜索功能...")
		songs, err := m.Search(testKeyword,
			meting.WithPage(1),
			meting.WithLimit(3),
		)
		if err != nil {
			fmt.Printf("✗ 搜索失败: %v\n", err)
			continue
		}

		if len(songs) > 0 {
			song := songs[0]
			fmt.Printf("✓ 搜索成功: %s - %v\n", song.Name, song.Artist)

			// 测试获取播放链接
			fmt.Println("测试获取播放链接...")
			url, err := m.URL(song.URLID, 128)
			if err != nil {
				fmt.Printf("✗ 获取播放链接出错: %v\n", err)
			} else if url.URL != "" {
				fmt.Println("✓ 获取播放链接成功")
				fmt.Printf("  URL: %s\n", url.URL)
				fmt.Printf("  码率: %d kbps\n", url.Bitrate)
				fmt.Printf("  大小: %d bytes\n", url.Size)
			} else {
				fmt.Println("✗ 获取播放链接失败（可能需要会员或已下架）")
			}

			// 测试获取歌词
			fmt.Println("测试获取歌词...")
			lyric, err := m.Lyric(song.LyricID)
			if err != nil {
				fmt.Printf("✗ 获取歌词出错: %v\n", err)
			} else if lyric.Lyric != "" {
				fmt.Println("✓ 获取歌词成功")
				fmt.Printf("  歌词长度: %d 字符\n", len(lyric.Lyric))
				if lyric.TLyric != "" {
					fmt.Printf("  翻译长度: %d 字符\n", len(lyric.TLyric))
				}
			} else {
				fmt.Println("✗ 获取歌词失败（可能无歌词）")
			}

			// 测试获取封面
			fmt.Println("测试获取封面图片...")
			pic, err := m.Pic(song.PicID, 300)
			if err != nil {
				fmt.Printf("✗ 获取封面图片出错: %v\n", err)
			} else if pic != "" {
				fmt.Println("✓ 获取封面图片成功")
				fmt.Printf("  封面URL: %s\n", pic)
			} else {
				fmt.Println("✗ 获取封面图片失败")
			}

			// 添加延迟避免请求过快
			time.Sleep(2 * time.Second)

		} else {
			fmt.Println("✗ 搜索失败或无结果")
		}
	}

	fmt.Println("\n=== 测试完成 ===")
}

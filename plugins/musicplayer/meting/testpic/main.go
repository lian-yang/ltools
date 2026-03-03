package main

import (
	"encoding/json"
	"fmt"
	"ltools/plugins/musicplayer/meting"
	"time"
)

func main() {
	fmt.Println("=== 测试网易云音乐封面图片 ===")

	// 创建 Meting 实例
	m, err := meting.NewMeting("netease")
	if err != nil {
		fmt.Printf("✗ 创建实例失败: %v\n", err)
		return
	}

	// 启用格式化
	m.Format(true)

	// 搜索歌曲
	fmt.Println("\n搜索歌曲...")
	songs, err := m.Search("周杰伦",
		meting.WithPage(1),
		meting.WithLimit(1),
	)
	if err != nil {
		fmt.Printf("✗ 搜索失败: %v\n", err)
		return
	}

	if len(songs) > 0 {
		song := songs[0]
		fmt.Printf("✓ 搜索成功: %s - %v\n", song.Name, song.Artist)
		fmt.Printf("  ID: %s\n", song.ID)
		fmt.Printf("  PicID: %s\n", song.PicID)
		fmt.Printf("  URLID: %s\n", song.URLID)
		fmt.Printf("  LyricID: %s\n", song.LyricID)

		// 获取封面图片
		fmt.Println("\n获取封面图片...")
		pic, err := m.Pic(song.PicID, 300)
		if err != nil {
			fmt.Printf("✗ 获取封面图片出错: %v\n", err)
		} else {
			fmt.Println("✓ 获取封面图片成功")
			fmt.Printf("  封面URL: %s\n", pic)
		}

		// 打印完整的 song JSON
		fmt.Println("\n完整的 Song JSON:")
		jsonData, _ := json.MarshalIndent(song, "", "  ")
		fmt.Println(string(jsonData))
	}

	// 添加延迟
	time.Sleep(2 * time.Second)

	fmt.Println("\n=== 测试完成 ===")
}

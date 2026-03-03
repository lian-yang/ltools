package meting

import (
	"fmt"
	"net/http"
)

// NewMeting 创建 Meting 实例（工厂函数）
// 注意：这个文件单独放置，避免循环导入
func NewMeting(platformName string) (*Meting, error) {
	var p Platform
	switch platformName {
	case "netease":
		p = newNeteaseAdapter()
	case "tencent", "qq":
		p = newTencentAdapter()
	case "kugou":
		p = newKugouAdapter()
	case "baidu":
		p = newBaiduAdapter()
	case "kuwo":
		p = newKuwoAdapter()
	default:
		return nil, fmt.Errorf("unsupported platform: %s", platformName)
	}

	// 创建 HTTP 客户端
	client := &http.Client{
		Timeout: defaultTimeout,
	}

	return &Meting{
		platform: p,
		format:   true,
		timeout:  defaultTimeout,
		client:   client,
		retries:  defaultRetries,
	}, nil
}

package main

import (
	"io/fs"
	"log"
	"net/http"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// CombinedAssetHandler 组合资源处理器
// 先尝试代理请求，如果不是代理请求则交给默认处理器
type CombinedAssetHandler struct {
	proxyHandler   http.Handler
	defaultHandler http.Handler
	assetsFS       fs.FS // 前端资源文件系统
	app            *application.App
	isProduction   bool // 缓存的环境信息：是否为生产模式
}

// NewCombinedAssetHandler 创建组合资源处理器
func NewCombinedAssetHandler(proxyHandler, defaultHandler http.Handler) *CombinedAssetHandler {
	return &CombinedAssetHandler{
		proxyHandler:   proxyHandler,
		defaultHandler: defaultHandler,
	}
}

// SetApp 设置应用实例引用并缓存环境信息
func (h *CombinedAssetHandler) SetApp(app *application.App) {
	h.app = app

	// 使用 Wails 环境信息判断是否为生产模式
	// Debug = true 表示开发模式，Debug = false 表示生产模式
	h.isProduction = !app.Env.Info().Debug

	if h.isProduction {
		// 生产模式：创建前端资源文件系统
		distFS, err := fs.Sub(assets, "frontend/dist")
		if err != nil {
			log.Printf("[AssetHandler] ❌ Failed to create sub filesystem: %v", err)
		} else {
			h.assetsFS = distFS
			log.Printf("[AssetHandler] ✅ Production mode: assetsFS created successfully")
		}
	}
}

// ServeHTTP 实现 http.Handler 接口
func (h *CombinedAssetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 1. 检查是否是代理请求
	if strings.HasPrefix(path, "/proxy/") {
		h.proxyHandler.ServeHTTP(w, r)
		return
	}

	// 2. SPA 路由支持：仅在非开发模式(生产模式)时启用
	if h.isProduction && h.assetsFS != nil {
		relativePath := strings.TrimPrefix(path, "/")

		// 检查文件系统
		_, err := fs.Stat(h.assetsFS, relativePath)
		if err != nil {
			// 文件不存在，作为前端路由处理，返回 index.html
			log.Printf("[AssetHandler] SPA route: %s", path)
			r.URL.Path = "/"
		}
	}

	// 3. 交给默认处理器
	h.defaultHandler.ServeHTTP(w, r)
}

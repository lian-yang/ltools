---
layout: home

hero:
  name: LTools
  text: 插件式桌面工具箱
  tagline: 一款现代化的跨平台桌面效率工具，采用插件化架构设计，为开发者提供开箱即用的工具集
  image:
    src: /images/hero-logo.svg
    alt: LTools Logo
  actions:
    - theme: brand
      text: 立即下载
      link: /download
    - theme: alt
      text: 功能介绍
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/lian-yang/ltools

features:
  - icon: 🧩
    title: 插件化架构
    details: 灵活的插件系统，支持内置插件和扩展插件。20+ 实用插件开箱即用，轻松定制你的工作流。
  - icon: 🔍
    title: 全局搜索
    details: 类 Spotlight/Alfred 的全局搜索体验，快捷键 Cmd/Ctrl+5 快速唤起，即时访问所有插件功能。
  - icon: ⚡
    title: 极速响应
    details: 基于 Go 和 React 的高性能架构，Wails v3 框架加持，秒级启动，流畅体验。
  - icon: 🖥️
    title: 跨平台支持
    details: 支持 macOS、Windows、Linux 主流平台，一致的界面和体验，无缝切换工作环境。
  - icon: ⌨️
    title: 快捷键系统
    details: 强大的全局热键支持，自定义快捷键触发插件，效率提升不止一倍。
  - icon: 🔄
    title: 自动更新
    details: 内置自动更新机制，启动后自动检测新版本，保持软件始终最新。
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #7C3AED 30%, #22D3EE);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #7C3AED 50%, #22D3EE 50%);
  --vp-home-hero-image-filter: blur(44px);
}

.VPFeatures .icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
</style>

## 内置插件一览

LTools 内置 **20+** 实用插件，覆盖开发、效率、系统工具等多个领域：

| 类别 | 插件 | 功能描述 |
|------|------|----------|
| **媒体工具** | 🎵 音乐播放器 | 内置音源服务，支持多音源、歌词同步、播放列表 |
| | 📸 截图工具 | 截图、标注、贴图，微信风格编辑器 |
| | 🖼️ 图床 | 图片上传和管理 |
| **开发工具** | 📝 JSON 编辑器 | 格式化、验证和编辑 JSON 数据（Monaco Editor） |
| | 🌐 Hosts 管理 | 编辑和管理系统 hosts 文件 |
| | 🚇 隧道管理 | SSH 隧道管理工具 |
| | 🔖 书签搜索 | 搜索 Chrome/Firefox/Safari 浏览器书签 |
| **效率工具** | 📋 剪贴板管理 | 自动监控并管理剪贴板历史 |
| | 🔐 密码生成器 | 生成安全的随机密码 |
| | 🔒 密码库 | 本地加密存储密码和敏感信息 |
| | 🤖 AI 翻译 | 基于本地模型的离线翻译 |
| | 📱 二维码 | 生成和识别二维码 |
| | 📋 看板 | 任务看板管理 |
| **系统工具** | 💻 系统信息 | 显示 CPU、内存、运行时间等系统状态 |
| | ⚙️ 进程管理 | 查看和管理系统进程 |
| | 🚀 应用启动器 | 快速启动应用程序 |
| **实用工具** | 📅 日期时间 | 实时显示当前日期、时间和星期 |
| | 🔢 计算器 | 支持基本运算和历史记录 |
| | 🌍 IP 信息 | 查询 IP 地址归属信息 |
| | 📌 贴图工具 | 图片置顶显示 |
| | 📄 Markdown | Markdown 编辑和预览 |

## 快速开始

### 安装

从 [Releases](https://github.com/lian-yang/ltools/releases) 页面下载最新版本：

::: code-group

```bash [macOS (DMG)]
# 下载并安装
curl -LO https://github.com/lian-yang/ltools/releases/latest/download/ltools-latest-darwin-arm64.dmg
open ltools-latest-darwin-arm64.dmg

# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

```bash [macOS (tar.gz)]
curl -LO https://github.com/lian-yang/ltools/releases/latest/download/ltools-latest-darwin-arm64.tar.gz
tar xzf ltools-latest-darwin-arm64.tar.gz
mv LTools.app /Applications/
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

```bash [Windows]
# 下载安装程序并运行
ltools-latest-windows-amd64-installer.exe
```

```bash [Linux (AppImage)]
curl -LO https://github.com/lian-yang/ltools/releases/latest/download/ltools-latest-linux-amd64.AppImage
chmod +x ltools-latest-linux-amd64.AppImage
./ltools-latest-linux-amd64.AppImage
```

:::

### 基本使用

1. **打开全局搜索**：按下 `Cmd+5` (macOS) 或 `Ctrl+5` (Windows/Linux)
2. **搜索插件**：输入插件名称或关键词，如 "calc" 打开计算器
3. **使用插件**：回车或点击打开插件，开始使用

## 界面预览

LTools 提供简洁现代的界面设计，采用玻璃态设计风格和深色主题。

主要界面包括：
- **主界面**：插件卡片展示，侧边栏导航
- **全局搜索**：无边框设计，即时搜索体验
- **插件视图**：每个插件独立的交互界面
- **设置页面**：统一的配置入口

## 技术栈

LTools 采用现代化的技术栈构建：

- **后端**：Go 1.25+、Wails v3、gohook、gopsutil
- **前端**：React 18.2、TypeScript 5.2、Vite 5、TailwindCSS 4
- **构建**：Task、Wails CLI
- **CI/CD**：GitHub Actions

## 参与贡献

欢迎提交 Issue 和 Pull Request！查看 [贡献指南](/dev/contributing) 了解更多。

## 许可证

本项目采用 [MIT 许可证](https://github.com/lian-yang/ltools/blob/main/LICENSE) 开源。

---

<div align="center">

**Made with ❤️ by LTools Contributors**

[GitHub](https://github.com/lian-yang/ltools) · [Releases](https://github.com/lian-yang/ltools/releases) · [Issues](https://github.com/lian-yang/ltools/issues)

</div>

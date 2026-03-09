# 快速开始

本指南将帮助你在几分钟内开始使用 LTools。

## 安装

### 1. 下载

访问 [下载页面](/download) 或 [GitHub Releases](https://github.com/lian-yang/ltools/releases) 下载适合你平台的安装包。

### 2. 安装

#### macOS

```bash
# 下载 DMG（以 v0.1.4 为例）
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-arm64.dmg

# 打开并安装
open ltools-v0.1.4-darwin-arm64.dmg

# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

#### Windows

下载安装程序并运行，按照向导完成安装。

#### Linux

```bash
# 下载 AppImage
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.AppImage
chmod +x ltools-v0.1.4-linux-amd64.AppImage
./ltools-v0.1.4-linux-amd64.AppImage
```

### 3. 启动

- **macOS**: 从 Launchpad 或 Applications 文件夹启动
- **Windows**: 从开始菜单或桌面快捷方式启动
- **Linux**: 运行 AppImage 文件

## 基本使用

### 全局搜索

全局搜索是 LTools 的核心功能，让你快速访问所有插件。

**打开搜索窗口**：
- macOS: `Cmd + 5`
- Windows/Linux: `Ctrl + 5`

**使用搜索**：
1. 按下快捷键打开搜索窗口
2. 输入关键词，如：
   - `calc` 或 `计算` - 打开计算器
   - `json` - 打开 JSON 编辑器
   - `clip` 或 `剪贴` - 打开剪贴板管理
3. 使用 `↑` `↓` 选择结果
4. 按 `Enter` 打开选中的插件

### 主界面

点击搜索结果中的「主页」或在侧边栏选择「首页」，可以进入主界面：

- **插件卡片**：显示所有已启用插件
- **侧边栏**：快速导航到不同插件
- **最近使用**：显示最近使用的插件

### 插件市场

在主界面点击「插件市场」或从侧边栏进入：

- 查看所有可用插件
- 启用/禁用插件
- 查看插件详情

## 常用插件速查

| 功能 | 关键词 | 快捷键 |
|------|--------|--------|
| 计算器 | calc, 计算 | - |
| 剪贴板 | clip, 剪贴 | - |
| JSON 编辑器 | json | - |
| 截图 | screenshot, 截图 | `Cmd/Ctrl+Shift+S` |
| 系统信息 | sysinfo, 系统 | - |
| 日期时间 | datetime, 时间 | - |
| 密码生成 | password, 密码 | - |

## 系统托盘

LTools 启动后会显示在系统托盘中：

- **显示/隐藏**: 点击托盘图标
- **快速功能**: 右键菜单
- **退出**: 右键菜单选择「退出」

## 设置

### 快捷键设置

1. 打开「设置」→「快捷键」
2. 点击要修改的快捷键
3. 按下新的组合键
4. 点击「保存」

### 插件管理

1. 打开「设置」→「插件」
2. 启用/禁用插件
3. 查看插件详情和权限

### 自动更新

1. 打开「设置」→「关于」
2. 点击「检查更新」
3. 或等待启动后自动检查

## 下一步

- [完整快捷键列表](./shortcuts)
- [插件详细介绍](/plugins/)
- [常见问题](./faq)
- [开发你自己的插件](/dev/plugin-development)

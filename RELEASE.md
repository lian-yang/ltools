# LTools {{VERSION}}

## 🎉 版本发布

### 系统要求

> **⚠️ 重要提示：音乐播放器功能需要 Node.js >= 16.0.0**

- **下载地址**：https://nodejs.org/
- **推荐版本**：LTS (Long Term Support)
- **检查版本**：运行 `node --version`

---

## 📦 下载地址

### 桌面端

| 平台 | 架构 | 文件名 | 大小 | 格式 |
|------|------|--------|------|------|
| **macOS** | ARM64 (M1/M2/M3) | `ltools-{{VERSION}}-darwin-arm64.tar.gz` | ~50 MB | .app bundle |
| **macOS** | AMD64 (Intel) | `ltools-{{VERSION}}-darwin-amd64.tar.gz` | ~50 MB | .app bundle |
| **Windows** | x64 | `ltools-{{VERSION}}-windows-amd64-installer.exe` | ~55 MB | NSIS 安装程序 |
| **Linux** | x64 | `ltools-{{VERSION}}-linux-amd64.AppImage` | ~52 MB | AppImage (推荐) |
| **Linux** | x64 | `ltools-{{VERSION}}-linux-amd64.deb` | ~52 MB | Debian/Ubuntu |
| **Linux** | x64 | `ltools-{{VERSION}}-linux-amd64.rpm` | ~52 MB | RHEL/CentOS/Fedora |

> **💡 提示**：所有构建文件均包含 SHA256 校验和，详见 [update.json](https://github.com/{{REPO}}/releases/download/{{VERSION}}/update.json)

---

## ✨ 核心功能

### 🔄 自动更新
- 启动 10 秒后自动检查更新
- 发现新版本时显示通知
- 支持手动检查（设置 → 关于 → 检查更新）

### 🎵 音乐播放器
- 内置音源服务（无需额外配置）
- 支持多音源切换
- 歌词同步显示
- 播放列表管理

### 📋 剪贴板管理
- 历史记录保存（默认 100 条）
- 快速搜索和粘贴
- 支持文本、图片、文件

### 🔍 全局搜索
- 快捷键快速唤起（Cmd/Ctrl+5）
- 插件内容搜索
- 实时搜索结果

---

## 🚀 安装指南

### macOS

#### 1. 安装 Node.js（首次使用）

```bash
# 检查是否已安装
node --version

# 如果未安装，访问 https://nodejs.org/ 下载 LTS 版本
# 或使用 Homebrew
brew install node
```

#### 2. 安装 LTools

```bash
# 下载对应架构的压缩包
# ARM64 (Apple Silicon - M1/M2/M3):
curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-darwin-arm64.tar.gz

# 或 AMD64 (Intel Mac):
# curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-darwin-amd64.tar.gz

# 解压
tar xzf ltools-{{VERSION}}-darwin-*.tar.gz

# 安装到 Applications
mv LTools.app /Applications/

# 启动
open /Applications/LTools.app

# ⚠️ 如果提示"已损坏"或"无法验证开发者"，运行：
sudo xattr -rd com.apple.quarantine /Applications/LTools.app
```

#### 3. macOS 安全提示

首次打开时，可能会遇到以下提示：

**"LTools 已损坏，无法打开"**

```bash
# 移除隔离属性（最常用）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 然后重新打开
open /Applications/LTools.app
```

**"无法验证开发者"**

1. 右键点击 LTools.app → 选择"打开"
2. 在弹出对话框中点击"打开"
3. 或访问：系统设置 → 隐私与安全性 → 仍要打开

> **💡 提示**：这是因为应用未经过 Apple 公证。上述操作后，以后就可以正常双击打开了。

#### 4. 授予辅助功能权限（可选）

如果需要使用全局快捷键，请在系统设置中授予权限：
- 系统设置 → 隐私与安全性 → 辅助功能 → 添加 LTools

### Windows

#### 1. 安装 Node.js（首次使用）

```powershell
# 检查是否已安装
node --version

# 如果未安装，访问 https://nodejs.org/ 下载 Windows Installer (.msi)
```

#### 2. 安装 LTools

```powershell
# 下载安装程序
# 方式 1: 使用浏览器下载
# 访问 https://github.com/{{REPO}}/releases/tag/{{VERSION}}
# 下载 ltools-{{VERSION}}-windows-amd64-installer.exe

# 方式 2: 使用 PowerShell 下载
Invoke-WebRequest -Uri "https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-windows-amd64-installer.exe" -OutFile "ltools-installer.exe"

# 运行安装程序
.\ltools-installer.exe

# 安装完成后，从开始菜单或桌面快捷方式启动
```

### Linux

#### 1. 安装 Node.js（首次使用）

```bash
# 检查是否已安装
node --version

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# RHEL/CentOS/Fedora
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
```

#### 2. 安装 LTools

**方式 A: AppImage（推荐）**

```bash
# 下载
curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-linux-amd64.AppImage

# 添加执行权限
chmod +x ltools-{{VERSION}}-linux-amd64.AppImage

# 运行
./ltools-{{VERSION}}-linux-amd64.AppImage

# 可选：安装到系统
sudo mv ltools-{{VERSION}}-linux-amd64.AppImage /usr/local/bin/ltools
```

**方式 B: DEB 包（Debian/Ubuntu）**

```bash
# 下载
curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-linux-amd64.deb

# 安装
sudo dpkg -i ltools-{{VERSION}}-linux-amd64.deb

# 如果有依赖问题，运行
sudo apt-get install -f

# 启动
ltools
```

**方式 C: RPM 包（RHEL/CentOS/Fedora）**

```bash
# 下载
curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/ltools-{{VERSION}}-linux-amd64.rpm

# 安装
sudo rpm -i ltools-{{VERSION}}-linux-amd64.rpm

# 启动
ltools
```

---

## 📦 包含的组件

### LTools 主程序
- 基于 Wails v3 的跨平台桌面应用
- 插件化架构，易于扩展
- 系统托盘集成

### 音乐播放器服务（自动安装）
- **安装方式**：首次运行时自动从应用内提取
- **实际位置**：
  - **macOS**: `~/Library/Application Support/ltools/lx-music-service/`
  - **Linux**: `~/.config/ltools/lx-music-service/`
  - **Windows**: `%APPDATA%\ltools\lx-music-service\`
- **包含内容**：
  - `server.bundle.js` - 打包后的服务代码（~1.7MB）
  - `sources/` - 多音源插件
- **特点**：
  - 无需手动配置，开箱即用
  - 支持多音源切换
  - 自动代理支持

---

## 🔧 故障排查

### 音乐播放器无法使用

**症状**：点击播放无反应，或提示"服务未启动"

**解决方案**：

```bash
# 1. 检查 Node.js 版本（必须 >= v16.0.0）
node --version

# 2. 检查音乐服务是否已提取到用户目录
# macOS:
ls -la ~/Library/Application\ Support/ltools/lx-music-service/

# Linux:
ls -la ~/.config/ltools/lx-music-service/

# Windows (PowerShell):
ls "$env:APPDATA\ltools\lx-music-service\"

# 应该看到以下文件：
# - server.bundle.js
# - sources/ 目录

# 3. 如果服务目录损坏，删除后会自动重新提取
# macOS:
rm -rf ~/Library/Application\ Support/ltools/lx-music-service/

# Linux:
rm -rf ~/.config/ltools/lx-music-service/

# Windows (PowerShell):
Remove-Item -Recurse -Force "$env:APPDATA\ltools\lx-music-service"

# 4. 重启应用，服务会自动重新提取

# 5. 手动测试音乐服务（调试用）
# macOS:
cd ~/Library/Application\ Support/ltools/lx-music-service/
# Linux:
# cd ~/.config/ltools/lx-music-service/
# Windows (PowerShell):
# cd "$env:APPDATA\ltools\lx-music-service\"

node server.bundle.js
# 如果服务正常，会显示类似：
# LX Music Service started on port 23330
```
ls "C:\Program Files\My Company\LTools\lx-music-service\"

# Linux (DEB/RPM):
ls /usr/local/share/ltools/lx-music-service/

# 3. 手动测试音乐服务
cd /path/to/lx-music-service
node dist/server.bundle.js
```

### 应用无法启动

#### macOS 安全性与隐私问题

**问题 1: "已损坏，无法打开" 或 "无法验证开发者"**

这是 macOS 对未签名应用的安全保护。

**解决方案 1: 使用 xattr 移除隔离属性**

```bash
# 方法 A: 移除整个应用的隔离属性（推荐）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 方法 B: 只移除可执行文件的隔离属性
sudo xattr -d com.apple.quarantine /Applications/LTools.app/Contents/MacOS/LTools

# 验证是否成功
xattr /Applications/LTools.app
# 如果没有输出 com.apple.quarantine，说明已成功
```

**解决方案 2: 系统设置中允许**

1. 首次打开时，会提示"无法打开 LTools，因为无法验证开发者"
2. 点击"好"
3. 打开 **系统设置** → **隐私与安全性**
4. 向下滚动，找到 "仍要打开" 按钮
5. 点击"仍要打开"，输入密码确认
6. 再次打开应用

**解决方案 3: 通过右键打开**

1. 在 Finder 中找到 LTools.app
2. 按住 Control 键，点击应用图标（或右键点击）
3. 选择"打开"
4. 在弹出的对话框中点击"打开"
5. 以后就可以正常双击打开了

**问题 2: "无法打开，因为无法确认开发者的身份"**

```bash
# 允许运行任何来源的应用（不推荐，有安全风险）
sudo spctl --master-disable

# 查看当前安全设置
spctl --status

# 更安全的方式：仅允许 LTools
sudo spctl --add /Applications/LTools.app
sudo spctl --enable --label "LTools"
```

**问题 3: 辅助功能权限（全局快捷键需要）**

如果全局快捷键（Cmd+5 等）不工作：

1. 打开 **系统设置** → **隐私与安全性** → **辅助功能**
2. 点击左下角的锁图标，输入密码解锁
3. 点击 "+" 按钮，添加 LTools.app
4. 如果已经在列表中，勾选 LTools
5. 重启应用

**问题 4: 应用闪退或无响应**

```bash
# 检查系统日志
log show --predicate 'process == "LTools"' --last 1h

# 检查崩溃报告
ls ~/Library/Logs/DiagnosticReports/ | grep LTools

# 查看最近的崩溃报告
cat ~/Library/Logs/DiagnosticReports/LTools_*.crash | head -100

# 授予执行权限
chmod +x /Applications/LTools.app/Contents/MacOS/LTools

# 验证应用完整性
codesign --verify --verbose /Applications/LTools.app
# 预期输出: /Applications/LTools.app: valid on disk
```

**问题 5: macOS Gatekeeper 阻止**

```bash
# 查看 Gatekeeper 状态
spctl --status

# 临时禁用 Gatekeeper（不推荐长期使用）
sudo spctl --master-disable

# 重新启用 Gatekeeper
sudo spctl --master-enable

# 将 LTools 添加到允许列表
sudo spctl --add /Applications/LTools.app
```

> **📖 更多 macOS 安全性问题**：查看 [macOS 安全性快速参考](docs/macOS_SECURITY.md) 获取完整的问题排查指南

#### macOS 通用问题

```bash
# 授予执行权限
chmod +x /Applications/LTools.app/Contents/MacOS/LTools

# 查看日志
log show --predicate 'process == "LTools"' --last 1h
```

#### Windows

- 检查防病毒软件是否拦截
- 以管理员身份运行
- 查看 Windows 事件查看器

**Linux:**

```bash
# 检查依赖
ldd /usr/local/bin/ltools

# 查看日志
journalctl -xe | grep ltools

# AppImage 调试
./ltools-{{VERSION}}-linux-amd64.AppImage --appimage-help
```

### 自动更新失败

**检查清单**：
- [ ] 网络连接正常
- [ ] 防火墙未阻止应用访问网络
- [ ] 有足够的磁盘空间
- [ ] 有写入权限（macOS/Linux）

**手动更新**：
1. 下载最新版本
2. 替换旧版本
3. 重启应用

### 全局快捷键不工作

**macOS:**

1. 系统设置 → 隐私与安全性 → 辅助功能
2. 添加 LTools 到允许列表
3. 重启应用

**Linux:**

- AppImage 可能需要特殊权限
- 尝试使用 DEB/RPM 安装版本

---

## 🔐 验证下载

### 验证 SHA256 校验和

```bash
# 下载 update.json
curl -LO https://github.com/{{REPO}}/releases/download/{{VERSION}}/update.json

# 查看校验和
cat update.json | grep -A 2 "darwin-arm64"
# 输出: "checksum": "sha256:xxxx..."

# 验证下载文件（以 macOS ARM64 为例）
shasum -a 256 ltools-{{VERSION}}-darwin-arm64.tar.gz
# 比较输出的哈希值与 update.json 中的值
```

---

## 📖 相关链接

- **完整更新日志**：[Commits](https://github.com/{{REPO}}/commits/{{VERSION}})
- **问题反馈**：[Issues](https://github.com/{{REPO}}/issues)
- **项目主页**：[README](https://github.com/{{REPO}}#readme)
- **更新清单**：[update.json](https://github.com/{{REPO}}/releases/download/{{VERSION}}/update.json)

---

## 💬 反馈与支持

如果您遇到问题或有功能建议：

1. **搜索现有 Issues**：https://github.com/{{REPO}}/issues
2. **创建新 Issue**：提供详细的复现步骤和系统信息
3. **查看文档**：https://github.com/{{REPO}}/tree/main/docs

---

**感谢使用 LTools！** 🎉

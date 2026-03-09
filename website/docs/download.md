# 下载 LTools

选择适合你平台的版本进行下载。所有版本均为免费开源软件。

## 最新版本

当前最新版本：**v0.1.4** [查看更新日志](https://github.com/lian-yang/ltools/releases)

## macOS

::: tip 推荐安装方式
使用 DMG 安装包是最简单的方式，支持拖拽安装。
:::

### Apple Silicon (M1/M2/M3)

- **DMG 安装包** (推荐): [ltools-v0.1.4-darwin-arm64.dmg](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-arm64.dmg)
- **tar.gz 压缩包**: [ltools-v0.1.4-darwin-arm64.tar.gz](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-arm64.tar.gz)

### Intel Mac

- **tar.gz 压缩包**: [ltools-v0.1.4-darwin-amd64.tar.gz](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-amd64.tar.gz)

### macOS 安装步骤

::: code-group

```bash [DMG 安装]
# 1. 下载 DMG 文件
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-arm64.dmg

# 2. 打开 DMG
open ltools-v0.1.4-darwin-arm64.dmg

# 3. 拖拽 LTools.app 到 Applications 文件夹
# 4. 移除隔离属性（重要！）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 5. 启动应用
open /Applications/LTools.app
```

```bash [tar.gz 安装]
# 1. 下载压缩包
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-darwin-arm64.tar.gz

# 2. 解压
tar xzf ltools-v0.1.4-darwin-arm64.tar.gz

# 3. 移动到 Applications
mv LTools.app /Applications/

# 4. 移除隔离属性（重要！）
sudo xattr -rd com.apple.quarantine /Applications/LTools.app

# 5. 启动
open /Applications/LTools.app
```

:::

::: warning 安全性提示
首次打开可能会提示"已损坏"，这是因为应用未经过 Apple 公证。运行上述 `xattr` 命令即可解决。

更多帮助请查看 [macOS 安全性快速参考](https://github.com/lian-yang/ltools/blob/main/docs/macOS_SECURITY.md)。
:::

## Windows

- **安装程序**: [ltools-v0.1.4-windows-amd64-installer.exe](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-windows-amd64-installer.exe)

### Windows 安装步骤

1. 下载安装程序
2. 双击运行安装程序
3. 按照向导完成安装
4. 从开始菜单或桌面快捷方式启动

::: tip 系统要求
- Windows 10 或更高版本
- WebView2 运行时（通常已预装）
:::

## Linux

::: tip 推荐安装方式
AppImage 格式无需安装，下载后直接运行，支持大多数 Linux 发行版。
:::

### 通用包

- **AppImage** (推荐): [ltools-v0.1.4-linux-amd64.AppImage](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.AppImage)

### Debian/Ubuntu

- **DEB 包**: [ltools-v0.1.4-linux-amd64.deb](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.deb)

### RHEL/CentOS/Fedora

- **RPM 包**: [ltools-v0.1.4-linux-amd64.rpm](https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.rpm)

### Linux 安装步骤

::: code-group

```bash [AppImage]
# 1. 下载
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.AppImage

# 2. 添加执行权限
chmod +x ltools-v0.1.4-linux-amd64.AppImage

# 3. 运行
./ltools-v0.1.4-linux-amd64.AppImage
```

```bash [Debian/Ubuntu]
# 1. 下载
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.deb

# 2. 安装
sudo dpkg -i ltools-v0.1.4-linux-amd64.deb

# 3. 修复依赖（如有需要）
sudo apt-get install -f
```

```bash [RHEL/CentOS/Fedora]
# 1. 下载
curl -LO https://github.com/lian-yang/ltools/releases/download/v0.1.4/ltools-v0.1.4-linux-amd64.rpm

# 2. 安装
sudo rpm -i ltools-v0.1.4-linux-amd64.rpm
```

:::

## 校验文件完整性

所有发布文件都提供 SHA256 校验和，可在 [releases](https://github.com/lian-yang/ltools/releases) 页面查看。

```bash
# 验证 SHA256 校验和
shasum -a 256 -c checksums.txt
```

## 系统要求

| 要求 | 最低配置 | 推荐配置 |
|------|----------|----------|
| **操作系统** | macOS 11+ / Windows 10+ / Ubuntu 20.04+ | 最新版本 |
| **内存** | 512 MB | 2 GB+ |
| **磁盘空间** | 200 MB | 500 MB+ |
| **Node.js** | 16.0+ (仅音乐播放器需要) | 18.0+ |

## 历史版本

所有历史版本可在 [GitHub Releases](https://github.com/lian-yang/ltools/releases) 页面找到。

## 问题反馈

如果在下载或安装过程中遇到问题，请：

1. 查看 [常见问题](https://github.com/lian-yang/ltools/discussions/categories/q-a)
2. 提交 [Issue](https://github.com/lian-yang/ltools/issues/new/choose)
3. 参与 [讨论](https://github.com/lian-yang/ltools/discussions)

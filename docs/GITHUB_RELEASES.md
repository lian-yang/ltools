# GitHub Releases 自动更新配置指南

## 概述

LTools 使用 GitHub Releases 作为更新服务器，实现完全自动化的发布和更新流程。

> **📋 快速发布指南：** 查看 [发布流程指南](RELEASE_PROCESS.md) 或 [快速参考](../RELEASING.md)

## 架构

```
┌──────────────────────────────┐
│   GitHub Repository          │
│                              │
│  /update.json (固定 URL)     │ ← 应用检查这个文件
│  /releases/                  │
│    └── v0.2.0/               │
│        ├── update.json       │ ← 发布时生成
│        ├── ltools-v0.2.0-*.tar.gz
│        └── ltools-v0.2.0-*.zip
└──────────────────────────────┘
         ↑
         │ HTTPS (自动更新)
         │
┌────────┴────────────┐
│  LTools 应用        │
│  (启动10秒后检查)   │
└─────────────────────┘
```

## 配置说明

### 1. 更新 URL 配置

在 `main.go` 中，更新服务已配置为使用 GitHub raw URL：

```go
updateService := update.NewService(&update.ServiceConfig{
    CurrentVersion: "0.1.0",
    UpdateURL:      "https://raw.githubusercontent.com/lian-yang/ltools/main/",
    DataDir:        dataDir,
    Enabled:        true,
})
```

**URL 说明：**
- `https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
- 这是仓库根目录的 `update.json` 文件
- 每次发布新版本时，GitHub Actions 会自动更新这个文件

### 2. GitHub Actions 工作流

**文件位置：** `.github/workflows/release.yml`

**触发条件：** 推送 tag（如 `v0.2.0`）

**工作流程：**
1. 构建 macOS、Windows、Linux 三个平台
2. 打包应用为 `.tar.gz` 或 `.zip`
3. 生成 `update.json`（包含 SHA256 校验和）
4. 创建 GitHub Release
5. 上传所有文件到 Release
6. 更新仓库根目录的 `update.json`

### 3. update.json 管理

**两个位置：**

1. **仓库根目录：** `/update.json`
   - 固定 URL：`https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
   - 指向最新版本
   - 应用启动时检查此文件

2. **每个 Release：** `https://github.com/lian-yang/ltools/releases/download/v0.2.0/update.json`
   - 特定版本的清单
   - 作为发布记录

---

## 发布流程

### 方式 1: 使用 Git Tag（推荐）

```bash
# 1. 更新版本号
vim build/config.yml  # version: "0.2.0"

# 2. 提交更改
git add build/config.yml
git commit -m "chore: bump version to 0.2.0"

# 3. 创建 tag（带发布说明）
git tag -a v0.2.0 -m "## 新功能
- 添加某某功能
- 新增某某特性

## 改进
- 优化性能
- 改进用户体验

## 修复
- 修复已知 BUG"

# 4. 推送 tag
git push origin v0.2.0

# 5. 等待 GitHub Actions 自动构建和发布
# 大约需要 10-15 分钟
```

**重要说明：**
- **Tag 消息会作为 `update.json` 中的 `releaseNotes`**
- 消息会自动过滤 `Co-Authored-By:` 签名行
- 如果 tag 消息为空，会使用默认内容：`## 改进\n- 性能优化\n- 用户体验优化\n\n## 修复\n- 修复已知 BUG`
- **GitHub Release 页面的内容**从 `RELEASE.md` 文件读取

### 方式 2: 使用 GitHub Web UI

1. 访问仓库的 "Releases" 页面
2. 点击 "Draft a new release"
3. 选择或创建 tag（如 `v0.2.0`）
4. 填写发布说明
5. 点击 "Publish release"
6. GitHub Actions 会自动触发构建

---

## 发布内容

每个 Release 包含：

### 文件列表

```
v0.2.0/
├── ltools-v0.2.0-darwin-arm64.tar.gz   # macOS ARM64
├── ltools-v0.2.0-darwin-amd64.tar.gz   # macOS Intel (可选)
├── ltools-v0.2.0-windows-amd64.zip     # Windows
├── ltools-v0.2.0-linux-amd64.tar.gz    # Linux
└── update.json                         # 更新清单
```

### Release Notes 自动生成

```markdown
## 🎉 LTools v0.2.0 发布

### 下载地址

| 平台 | 文件 |
|------|------|
| macOS (ARM64) | ltools-v0.2.0-darwin-arm64.tar.gz |
| Windows (x64) | ltools-v0.2.0-windows-amd64.zip |
| Linux (x64) | ltools-v0.2.0-linux-amd64.tar.gz |

### 自动更新

此版本已配置自动更新，应用会在启动 10 秒后自动检查更新。

更新清单：update.json

### 安装说明

...
```

---

## 用户端使用

### 自动更新流程

1. **启动应用**
   ```bash
   open LTools.app  # macOS
   ```

2. **自动检查（10 秒后）**
   - 应用访问 `https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
   - 比较版本号
   - 如果有新版本，显示通知

3. **用户确认更新**
   - 点击"立即下载"
   - 下载进度显示
   - 下载完成后点击"安装并重启"

### 手动检查更新

- 点击应用右下角的刷新按钮

---

## 测试发布

### 本地测试

```bash
# 1. 创建测试 tag
git tag v0.1.1-test
git push origin v0.1.1-test

# 2. 查看 GitHub Actions 运行状态
open https://github.com/lian-yang/ltools/actions

# 3. 检查 Release
open https://github.com/lian-yang/ltools/releases

# 4. 测试更新清单
curl https://raw.githubusercontent.com/lian-yang/ltools/main/update.json | jq .

# 5. 删除测试 tag 和 release（如果需要）
gh release delete v0.1.1-test --yes
git push --delete origin v0.1.1-test
```

### 验证更新流程

```bash
# 1. 下载并运行旧版本（如 v0.1.0）

# 2. 修改 main.go 临时指向测试 URL
UpdateURL: "https://raw.githubusercontent.com/lian-yang/ltools/main/"

# 3. 启动应用，等待 10 秒

# 4. 应该看到更新通知（如果有新版本）
```

---

## 故障排查

### 问题 1: GitHub Actions 失败

**检查步骤：**
```bash
# 查看 Actions 日志
open https://github.com/lian-yang/ltools/actions

# 常见错误：
# - Task 未安装：检查 Taskfile 安装步骤
# - Wails 构建失败：检查 Go 和 Node.js 版本
# - 权限错误：检查 GITHUB_TOKEN 权限
```

### 问题 2: update.json 未更新

**原因：** Git 推送失败或权限问题

**解决方案：**
```bash
# 检查 GitHub Token 权限
# Settings -> Actions -> General -> Workflow permissions
# 选择 "Read and write permissions"

# 手动更新 update.json
gh release download v0.2.0 --pattern update.json
cp update.json ./update.json
git add update.json
git commit -m "chore: update manifest for v0.2.0"
git push origin main
```

### 问题 3: 应用无法检查更新

**检查清单：**
- [ ] 网络连接正常
- [ ] URL 正确：`https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
- [ ] update.json 格式正确
- [ ] 版本号大于当前版本

```bash
# 测试 URL 可访问性
curl -I https://raw.githubusercontent.com/lian-yang/ltools/main/update.json

# 检查 JSON 格式
curl https://raw.githubusercontent.com/lian-yang/ltools/main/update.json | jq .
```

---

## 高级配置

### 发布说明来源

LTools 使用两个来源的发布说明：

#### 1. Tag 消息（用于 update.json）

**用途：** 应用内更新通知的 `releaseNotes` 字段

**获取方式：**
```bash
# 创建带消息的 tag
git tag -a v1.0.0 -m "## 新功能
- 功能 1
- 功能 2

## 修复
- 修复 1"
```

**自动处理：**
- 过滤 `Co-Authored-By:` 签名行
- 空消息使用默认内容

**脚本实现：** `scripts/generate-update-manifest.sh`
```bash
# 从 git tag 获取消息
TAG_MSG=$(git tag -l --format='%(contents)' "$VERSION")
# 过滤 Co-Authored-By
TAG_MSG=$(echo "$TAG_MSG" | grep -v "Co-Authored-By:")
```

#### 2. RELEASE.md 文件（用于 GitHub Release）

**用途：** GitHub Release 页面的完整发布说明

**文件位置：** 仓库根目录 `RELEASE.md`

**模板变量：**
- `{{VERSION}}` - 自动替换为版本号（如 `v1.0.0`）
- `{{REPO}}` - 自动替换为 `github.repository`

**修改方式：**
```bash
# 编辑 RELEASE.md
vim RELEASE.md

# 提交更改
git add RELEASE.md
git commit -m "docs: 更新发布说明模板"
```

**GitHub Actions 处理：** `.github/workflows/release.yml`
```yaml
- name: Read release notes
  run: |
    # 读取 RELEASE.md 并替换占位符
    RELEASE_BODY=$(cat RELEASE.md | \
      sed "s|{{VERSION}}|${{ github.ref_name }}|g" | \
      sed "s|{{REPO}}|${{ github.repository }}|g")
    echo "$RELEASE_BODY" > /tmp/release_body.md
```

### 添加补丁更新

```bash
# 1. 生成补丁
bsdiff old-app new-app patch.bsdiff

# 2. 上传补丁到 Release
gh release upload v0.2.0 patch.bsdiff

# 3. 手动更新 update.json 添加 patches 字段
```

### 支持 Beta 通道

创建不同的 update.json：

```
/update.json          # stable
/beta/update.json     # beta
/alpha/update.json    # alpha
```

---

## 相关文档

- [自动更新实现文档](AUTO_UPDATE.md)
- [音乐播放器分发指南](../plugins/musicplayer/DISTRIBUTION.md)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

## 总结

✅ **自动化发布流程**

1. 推送 tag（`git push origin v0.2.0`）
2. GitHub Actions 自动构建
3. 自动创建 Release
4. 自动生成 update.json
5. 自动更新仓库根目录的 update.json

✅ **自动更新流程**

1. 应用启动 10 秒后检查更新
2. 访问 `https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
3. 显示更新通知
4. 下载并安装更新

✅ **优势**

- 完全自动化，无需手动上传
- 免费（GitHub Releases 免费）
- 可靠（GitHub CDN）
- 易于管理和回滚

🎉 **配置完成！** 推送一个 tag 即可测试完整流程！

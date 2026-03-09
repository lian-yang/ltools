# 发布流程

本文档说明如何发布 LTools 新版本。

## 自动更新架构

LTools 使用 GitHub Releases 作为更新服务器，实现完全自动化的发布和更新流程。

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

**更新 URL**：`https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`

## 发布前准备

### 1. 版本号规划

使用语义化版本（SemVer）：

```
MAJOR.MINOR.PATCH

- MAJOR: 不兼容的 API 修改
- MINOR: 向后兼容的功能新增
- PATCH: 向后兼容的问题修复
```

**示例**：
- `0.1.0` → `0.1.1`：Bug 修复
- `0.1.1` → `0.2.0`：新功能
- `0.2.0` → `1.0.0`：重大更新

### 2. 准备发布说明

**Tag 消息（用于应用内更新通知）**：

Tag 消息会作为 `update.json` 中的 `releaseNotes` 字段，在应用内更新通知中显示。

**RELEASE.md（用于 GitHub Release 页面）**：

仓库根目录的 `RELEASE.md` 文件用于 GitHub Release 页面的完整发布说明。可以使用模板变量：
- `{{VERSION}}` - 自动替换为版本号（如 `v1.0.0`）
- `{{REPO}}` - 自动替换为 `github.repository`

示例格式：
```markdown
## 🎉 LTools v1.2.0 发布

### 新功能
- 添加二维码识别功能
- 支持自定义主题

### 改进
- 优化搜索性能
- 改进内存使用

### 修复
- 修复剪贴板历史显示问题
- 修复快捷键冲突

### 下载地址

| 平台 | 文件 |
|------|------|
| macOS (ARM64) | ltools-v1.2.0-darwin-arm64.tar.gz |
| Windows (x64) | ltools-v1.2.0-windows-amd64.zip |
| Linux (x64) | ltools-v1.2.0-linux-amd64.tar.gz |

### 安装说明
...
```

### 3. 版本更新

更新版本号：

**build/config.yml**：
```yaml
info:
  version: "1.2.0"  # 更新此处
```

### 4. 测试验证

发布前必须测试：

**功能测试**：
- [ ] 所有插件正常工作
- [ ] 快捷键正常
- [ ] 搜索功能正常
- [ ] 自动更新正常

**平台测试**：
- [ ] macOS (ARM64)
- [ ] macOS (Intel)
- [ ] Windows
- [ ] Linux

**构建测试**：
```bash
# 测试构建
task build

# 运行应用测试
./bin/ltools
```

## 发布步骤（推荐方式）

### 方式 1：使用 Git Tag（推荐）

```bash
# 1. 更新版本号
vim build/config.yml  # version: "1.2.0"

# 2. 提交更改
git add build/config.yml
git commit -m "chore: 准备发布 v1.2.0"

# 3. 创建 tag（带发布说明）
git tag -a v1.2.0 -m "## 新功能
- 添加某某功能
- 新增某某特性

## 改进
- 优化性能
- 改进用户体验

## 修复
- 修复已知 BUG"

# 4. 推送更改和 tag
git push origin main
git push origin v1.2.0

# 5. 等待 GitHub Actions 自动构建和发布
# 大约需要 10-15 分钟
```

**重要说明**：
- **Tag 消息会作为 `update.json` 中的 `releaseNotes`**
- 消息会自动过滤 `Co-Authored-By:` 签名行
- 如果 tag 消息为空，会使用默认内容
- **GitHub Release 页面的内容**从 `RELEASE.md` 文件读取

### 方式 2：使用 GitHub Web UI

1. 访问仓库的 "Releases" 页面
2. 点击 "Draft a new release"
3. 选择或创建 tag（如 `v1.2.0`）
4. 填写发布说明
5. 点击 "Publish release"
6. GitHub Actions 会自动触发构建

## GitHub Actions 自动构建

推送标签后，GitHub Actions 自动：

1. 构建所有平台（macOS、Windows、Linux）
2. 打包应用为 `.tar.gz` 或 `.zip`
3. 生成 `update.json`（包含 SHA256 校验和）
4. 创建 GitHub Release
5. 上传所有文件到 Release
6. 更新仓库根目录的 `update.json`

**监控构建**：
- 访问 Actions 页面
- 查看构建进度
- 检查是否成功

## update.json 管理

**两个位置**：

1. **仓库根目录**：`/update.json`
   - 固定 URL：`https://raw.githubusercontent.com/lian-yang/ltools/main/update.json`
   - 指向最新版本
   - 应用启动时检查此文件

2. **每个 Release**：`https://github.com/lian-yang/ltools/releases/download/v1.2.0/update.json`
   - 特定版本的清单
   - 作为发布记录

## 发布内容

每个 Release 包含：

```
v1.2.0/
├── ltools-v1.2.0-darwin-arm64.tar.gz   # macOS ARM64
├── ltools-v1.2.0-darwin-amd64.tar.gz   # macOS Intel (可选)
├── ltools-v1.2.0-windows-amd64.zip     # Windows
├── ltools-v1.2.0-linux-amd64.tar.gz    # Linux
└── update.json                         # 更新清单
```

## 验证发布

**检查 Release**：
1. 访问 [Releases](https://github.com/lian-yang/ltools/releases)
2. 确认 v1.2.0 已创建
3. 检查所有文件已上传

**测试下载**：
```bash
# 下载测试
curl -LO https://github.com/lian-yang/ltools/releases/download/v1.2.0/ltools-v1.2.0-darwin-arm64.tar.gz

# 验证文件
shasum -a 256 ltools-v1.2.0-darwin-arm64.tar.gz
```

**验证 update.json**：
```bash
# 检查仓库根目录的 update.json
curl https://raw.githubusercontent.com/lian-yang/ltools/main/update.json | jq .

# 检查特定版本的 update.json
curl https://github.com/lian-yang/ltools/releases/download/v1.2.0/update.json | jq .
```

**测试自动更新**：
1. 安装旧版本（如 v1.1.0）
2. 启动应用，等待 10 秒
3. 应该看到更新通知（如果有新版本）
4. 测试下载和安装流程

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

# 2. 启动应用，等待 10 秒

# 3. 应该看到更新通知（如果有新版本）
```

### 1. 更新官网

```bash
# 更新下载页面
vim website/docs/download.md

# 更新更新日志
vim website/docs/changelog.md

# 提交并推送
git add .
git commit -m "docs: 更新 v1.2.0 文档"
git push origin main
```

### 2. 公告发布

**GitHub Release**：
- 编辑 Release Notes
- 添加截图和 GIF
- 说明重要变更

**社交媒体**（如有）：
- Twitter
- 微博
- 等等

### 3. 关闭里程碑

在 GitHub：
1. 关闭相关 Issues
2. 更新 Milestone
3. 归档项目看板

### 4. 收集反馈

发布后：
- 监控 Issue 反馈
- 收集用户意见
- 规划下个版本

## 热修复流程

紧急问题的快速修复：

### 1. 创建热修复分支

```bash
# 基于 tag 创建
git checkout -b hotfix/v1.2.1 v1.2.0
```

### 2. 修复问题

```bash
# 修复代码
git add .
git commit -m "fix: 修复紧急问题"
```

### 3. 快速发布

```bash
# 更新版本号
vim build/config.yml  # 1.2.1

# 创建标签
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin v1.2.1
```

## 回滚流程

如果发布出现严重问题：

### 1. 标记问题版本

```bash
# 删除远程标签
git push --delete origin v1.2.0

# 删除本地标签
git tag -d v1.2.0
```

### 2. 发布修复版本

```bash
# 修复后重新发布
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin v1.2.1
```

## 发布检查清单

### 发布前

- [ ] 版本号已更新
- [ ] 更新日志已准备
- [ ] 所有测试通过
- [ ] 多平台测试完成
- [ ] 文档已更新

### 发布中

- [ ] Git 标签已创建
- [ ] GitHub Actions 成功
- [ ] Release 已创建
- [ ] 文件已上传

### 发布后

- [ ] 下载测试通过
- [ ] 自动更新测试
- [ ] 官网已更新
- [ ] 公告已发布
- [ ] 反馈已收集

## 常见问题

### Q: 构建失败怎么办？

**A**:
```bash
# 查看 Actions 日志
open https://github.com/lian-yang/ltools/actions

# 常见错误：
# - Task 未安装：检查 Taskfile 安装步骤
# - Wails 构建失败：检查 Go 和 Node.js 版本
# - 权限错误：检查 GITHUB_TOKEN 权限
```

### Q: update.json 未更新？

**A**:
```bash
# 检查 GitHub Token 权限
# Settings -> Actions -> General -> Workflow permissions
# 选择 "Read and write permissions"

# 手动更新 update.json
gh release download v1.2.0 --pattern update.json
cp update.json ./update.json
git add update.json
git commit -m "chore: update manifest for v1.2.0"
git push origin main
```

### Q: 应用无法检查更新？

**A**:
**检查清单**：
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

### Q: 如何撤销发布？

**A**:
1. 删除 GitHub Release
2. 删除 Git 标签
3. 修复问题后重新发布

```bash
# 删除 release
gh release delete v1.2.0 --yes

# 删除远程标签
git push --delete origin v1.2.0

# 删除本地标签
git tag -d v1.2.0

# 修复后重新发布
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin v1.2.1
```

### Q: Tag 消息如何编写？

**A**:
Tag 消息会作为应用内更新通知的 `releaseNotes` 字段。建议格式：

```bash
git tag -a v1.2.0 -m "## 新功能
- 添加二维码识别功能
- 支持自定义主题

## 改进
- 优化搜索性能
- 改进内存使用

## 修复
- 修复剪贴板历史显示问题
- 修复快捷键冲突"
```

**注意**：
- 消息会自动过滤 `Co-Authored-By:` 签名行
- 如果 tag 消息为空，会使用默认内容：`## 改进\n- 性能优化\n- 用户体验优化\n\n## 修复\n- 修复已知 BUG`

## 参考资源

- [语义化版本](https://semver.org/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [发布最佳实践](https://docs.github.com/en/repositories/releasing-projects-on-github)

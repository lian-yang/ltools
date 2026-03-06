# LTools 发布流程指南

本文档详细说明如何发布 LTools 的新版本。

## 快速开始

```bash
# 1. 更新版本号
vim build/config.yml

# 2. 创建 tag（带发布说明）
git tag -a v1.0.0 -m "## 新功能
- 添加某某功能

## 改进
- 优化性能

## 修复
- 修复已知 BUG"

# 3. 推送 tag，触发自动发布
git push origin v1.0.0
```

等待 10-15 分钟，GitHub Actions 会自动完成所有构建和发布工作。

---

## 详细步骤

### 1. 准备发布

#### 1.1 更新版本号

编辑 `build/config.yml`：

```yaml
info:
  productName: "LTools"
  productIdentifier: "com.ltools.app"
  description: "多功能开发工具集"
  version: "1.0.0"  # 更新这里
```

#### 1.2 提交版本更新

```bash
git add build/config.yml
git commit -m "chore: bump version to 1.0.0"
```

### 2. 创建 Git Tag

#### 2.1 基础方式（推荐）

```bash
# 创建带注释的 tag
git tag -a v1.0.0 -m "## 新功能
- 添加自动更新功能
- 新增音乐播放器插件

## 改进
- 优化启动速度
- 改进剪贴板管理

## 修复
- 修复已知 BUG"
```

#### 2.2 从文件读取

```bash
# 创建发布说明文件
cat > /tmp/release-notes.txt << 'EOF'
## 新功能
- 功能 1
- 功能 2

## 改进
- 改进 1

## 修复
- 修复 1
EOF

# 从文件创建 tag
git tag -a v1.0.0 -F /tmp/release-notes.txt
```

#### 2.3 交互式编辑

```bash
# 打开编辑器编辑 tag 消息
git tag -a v1.0.0
```

### 3. 推送 Tag 触发发布

```bash
# 推送单个 tag
git push origin v1.0.0

# 或推送所有 tag
git push origin --tags
```

### 4. 监控发布进度

#### 4.1 查看 GitHub Actions

```bash
# 在浏览器中打开
open https://github.com/lian-yang/ltools/actions
```

#### 4.2 发布流程

GitHub Actions 会自动执行以下步骤：

1. **构建阶段**（并行，约 5-8 分钟）
   - macOS (ARM64): 构建 .app bundle
   - Windows (x64): 构建 NSIS 安装程序
   - Linux (x64): 构建 AppImage、DEB、RPM

2. **发布阶段**（约 2-3 分钟）
   - 收集所有构建产物
   - 生成 `update.json`（从 tag 消息提取 releaseNotes）
   - 创建 GitHub Release（从 RELEASE.md 读取内容）
   - 上传所有文件
   - 更新仓库根目录的 `update.json`

### 5. 验证发布

#### 5.1 检查 Release 页面

```bash
open https://github.com/lian-yang/ltools/releases
```

确认以下内容：
- [ ] Release 标题正确（如 "v1.0.0"）
- [ ] 发布说明显示正确（来自 RELEASE.md）
- [ ] 所有平台文件都已上传
- [ ] `update.json` 文件存在

#### 5.2 检查更新清单

```bash
# 检查仓库根目录的 update.json
curl https://raw.githubusercontent.com/lian-yang/ltools/main/update.json | jq .

# 检查 release 中的 update.json
curl https://github.com/lian-yang/ltools/releases/download/v1.0.0/update.json | jq .
```

确认：
- [ ] `version` 字段正确（如 "1.0.0"）
- [ ] `releaseNotes` 包含 tag 消息内容
- [ ] `platforms` 包含所有平台的下载信息
- [ ] SHA256 校验和正确

#### 5.3 测试自动更新

1. 下载并安装旧版本（如 v0.9.0）
2. 启动应用，等待 10 秒
3. 应该看到更新通知
4. 检查通知内容是否正确

---

## 发布说明管理

### Tag 消息 vs RELEASE.md

LTools 使用两个来源的发布说明，各有不同用途：

| 来源 | 用途 | 显示位置 | 格式 |
|------|------|----------|------|
| **Git Tag 消息** | 应用内更新通知 | update.json → 应用 UI | 简洁的 Markdown |
| **RELEASE.md** | 完整发布说明 | GitHub Release 页面 | 详细的 Markdown |

### Tag 消息格式

**推荐格式：**

```markdown
## 新功能
- 功能描述 1
- 功能描述 2

## 改进
- 改进描述 1
- 改进描述 2

## 修复
- 修复描述 1
```

**示例：**

```bash
git tag -a v1.0.0 -m "## 新功能
- 添加自动更新功能
- 新增音乐播放器插件

## 改进
- 优化启动速度，提升 50%
- 改进剪贴板历史管理

## 修复
- 修复截图工具在多显示器下的问题
- 修复系统信息显示不准确的问题"
```

**注意事项：**
- ✅ 支持 Markdown 格式
- ✅ 自动过滤 `Co-Authored-By:` 签名
- ✅ 空消息使用默认内容
- ❌ 不应包含过多细节（会影响应用内显示）

### RELEASE.md 格式

**模板结构：**

```markdown
# LTools Release Notes

## 🎉 LTools {{VERSION}} 发布

### 系统要求
- Node.js >= 16.0.0

### 下载地址
| 平台 | 文件 |
|------|------|
| macOS | ltools-{{VERSION}}-darwin-arm64.tar.gz |
| Windows | ltools-{{VERSION}}-windows-amd64-installer.exe |
| Linux | ltools-{{VERSION}}-linux-amd64.AppImage |

### 新功能
...

### 安装说明
...

### 故障排查
...
```

**占位符：**
- `{{VERSION}}` - 自动替换为 tag 名称（如 `v1.0.0`）
- `{{REPO}}` - 自动替换为 `github.repository`

**修改方式：**

```bash
# 编辑 RELEASE.md
vim RELEASE.md

# 提交更改
git add RELEASE.md
git commit -m "docs: 更新发布说明模板"
git push origin main
```

---

## 特殊场景

### 预发布版本（Pre-release）

```bash
# 创建预发布 tag
git tag -a v1.0.0-beta.1 -m "## Beta 版本
- 测试新功能
- 可能不稳定"

# 推送 tag
git push origin v1.0.0-beta.1
```

**手动标记为 Pre-release：**
1. 访问 GitHub Release 页面
2. 编辑 release
3. 勾选 "Set as a pre-release"

### 修复错误的发布

#### 删除未推送的 tag

```bash
# 删除本地 tag
git tag -d v1.0.0
```

#### 删除已推送的 tag

```bash
# 删除远程 tag
git push --delete origin v1.0.0

# 删除本地 tag
git tag -d v1.0.0
```

#### 删除 GitHub Release

```bash
# 使用 gh CLI
gh release delete v1.0.0 --yes

# 或在 GitHub Web UI 中删除
```

### 重新发布同一版本

```bash
# 1. 删除旧的 tag 和 release
gh release delete v1.0.0 --yes
git push --delete origin v1.0.0
git tag -d v1.0.0

# 2. 创建新的 tag
git tag -a v1.0.0 -m "新的发布说明"

# 3. 推送 tag
git push origin v1.0.0
```

---

## 自动化细节

### generate-update-manifest.sh

**脚本位置：** `scripts/generate-update-manifest.sh`

**功能：**
1. 检查平台包文件是否存在
2. 计算每个文件的 SHA256 校验和
3. 从 git tag 消息获取 `releaseNotes`
4. 过滤 `Co-Authored-By:` 签名
5. 生成 `update.json`

**调用方式：**
```bash
./scripts/generate-update-manifest.sh \
  v1.0.0 \
  ./release \
  https://github.com/lian-yang/ltools/releases/download/v1.0.0
```

**Tag 消息处理：**
```bash
# 获取 tag 消息
TAG_MSG=$(git tag -l --format='%(contents)' "$VERSION")

# 过滤 Co-Authored-By
TAG_MSG=$(echo "$TAG_MSG" | grep -v "Co-Authored-By:")

# 如果为空，使用默认内容
if [ -z "$TAG_MSG" ]; then
  TAG_MSG="## 改进\n- 性能优化\n- 用户体验优化\n\n## 修复\n- 修复已知 BUG"
fi
```

### GitHub Actions Workflow

**文件位置：** `.github/workflows/release.yml`

**触发条件：**
```yaml
on:
  push:
    tags:
      - 'v*'
```

**关键步骤：**

1. **构建** - 并行构建 3 个平台
2. **生成更新清单** - 调用 `generate-update-manifest.sh`
3. **读取发布说明** - 从 `RELEASE.md` 读取并替换占位符
4. **创建 Release** - 使用 `softprops/action-gh-release@v2`
5. **更新 latest manifest** - 更新仓库根目录的 `update.json`

---

## 常见问题

### Q: Tag 消息太长会影响应用内显示吗？

A: 会。建议 tag 消息保持简洁（3-5 条要点），详细说明放在 `RELEASE.md` 中。

### Q: 忘记写 tag 消息怎么办？

A: 会使用默认内容：`## 改进\n- 性能优化\n- 用户体验优化\n\n## 修复\n- 修复已知 BUG`

### Q: 如何修改已发布的 Release 说明？

A:
1. 编辑 `RELEASE.md` 并提交
2. 访问 GitHub Release 页面，点击 "Edit release"
3. 手动更新说明内容

注意：已发布的 `update.json` 不会自动更新，需要重新发布。

### Q: 构建失败了怎么办？

A:
1. 查看 GitHub Actions 日志
2. 常见原因：
   - 依赖安装失败
   - 编译错误
   - 权限问题
3. 修复问题后，删除失败的 tag，重新创建并推送

### Q: 可以自定义默认的 releaseNotes 吗？

A: 可以。编辑 `scripts/generate-update-manifest.sh` 中的默认内容：

```bash
RELEASE_NOTES="## 改进
- 你的自定义内容

## 修复
- 你的自定义内容"
```

---

## 检查清单

发布前检查：

- [ ] 版本号已更新（`build/config.yml`）
- [ ] 代码已提交并推送到 main 分支
- [ ] `RELEASE.md` 模板已更新（如有需要）
- [ ] 准备好 tag 消息内容

发布后检查：

- [ ] GitHub Actions 构建成功
- [ ] GitHub Release 已创建
- [ ] 所有平台文件已上传
- [ ] `update.json` 格式正确
- [ ] 仓库根目录的 `update.json` 已更新
- [ ] 应用可以检查到新版本

---

## 相关文档

- [GitHub Releases 配置指南](GITHUB_RELEASES.md)
- [自动更新实现文档](AUTO_UPDATE.md)
- [自动更新用户指南](AUTO_UPDATE_GUIDE.md)

---

## 总结

✅ **发布流程**

1. 更新版本号 → 提交
2. 创建 tag（带消息）→ 推送
3. 等待 GitHub Actions 自动构建
4. 验证发布成功

✅ **发布说明来源**

- **Tag 消息** → `update.json` 的 `releaseNotes`（应用内显示）
- **RELEASE.md** → GitHub Release 页面（用户下载页）

✅ **自动化**

- 完全自动化的构建和发布
- 自动生成更新清单
- 自动过滤签名信息
- 自动更新 latest manifest

🎉 **简单、可靠、完全自动化！**

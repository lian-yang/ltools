# 发布快速参考

## 快速发布

```bash
# 1. 更新版本号
vim build/config.yml

# 2. 创建 tag（带发布说明）
git tag -a v1.0.0 -m "## 新功能
- 功能描述

## 改进
- 改进描述

## 修复
- 修复描述"

# 3. 推送 tag
git push origin v1.0.0
```

等待 10-15 分钟，GitHub Actions 自动完成发布。

## 发布说明来源

| 来源 | 用途 | 显示位置 |
|------|------|----------|
| **Git Tag 消息** | 应用内更新通知 | update.json → 应用 UI |
| **RELEASE.md** | 完整发布说明 | GitHub Release 页面 |

## Tag 消息格式

```markdown
## 新功能
- 功能 1
- 功能 2

## 改进
- 改进 1

## 修复
- 修复 1
```

**注意：** 自动过滤 `Co-Authored-By:` 签名

## RELEASE.md 模板

使用占位符：
- `{{VERSION}}` - 版本号
- `{{REPO}}` - 仓库名称

## 详细文档

- [完整发布流程指南](docs/RELEASE_PROCESS.md)
- [GitHub Releases 配置](docs/GITHUB_RELEASES.md)
- [自动更新实现](docs/AUTO_UPDATE.md)

## 常用命令

```bash
# 删除未推送的 tag
git tag -d v1.0.0

# 删除已推送的 tag
git push --delete origin v1.0.0

# 查看 GitHub Actions
open https://github.com/lian-yang/ltools/actions

# 查看发布
open https://github.com/lian-yang/ltools/releases

# 检查 update.json
curl https://raw.githubusercontent.com/lian-yang/ltools/main/update.json | jq .
```

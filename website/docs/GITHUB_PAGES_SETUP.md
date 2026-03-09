# GitHub Pages 配置指南

本指南帮助你配置 LTools 官网的 GitHub Pages 部署。

## 📋 前置条件

- ✅ GitHub Actions 工作流已创建 (`.github/workflows/deploy-website.yml`)
- ✅ VitePress 配置的 base 路径已设置 (`/ltools/`)
- ✅ 代码已推送到 main 分支

## 🚀 配置步骤

### 1. 启用 GitHub Pages

1. 访问你的 GitHub 仓库：https://github.com/lian-yang/ltools
2. 点击 **Settings** (设置) 标签
3. 在左侧菜单找到 **Pages**
4. 在 **Build and deployment** 部分：
   - **Source** (源): 选择 **GitHub Actions** (不是 Deploy from a branch)

![GitHub Pages 设置](https://docs.github.com/assets/cb-48779/mw-1440/images/help/pages/pages-source-actions.webp)

### 2. 触发部署

有两种方式触发部署：

#### 方式 A: 自动触发（推送代码）

```bash
# 对 website/ 目录的任何修改都会自动触发部署
git add website/
git commit -m "docs: 更新文档"
git push origin main
```

#### 方式 B: 手动触发

1. 访问仓库的 **Actions** 标签
2. 在左侧找到 **Deploy VitePress site to Pages** 工作流
3. 点击 **Run workflow** 按钮
4. 选择 main 分支并运行

### 3. 查看部署状态

1. 访问 **Actions** 标签
2. 查看最新的工作流运行
3. 等待两个任务完成：
   - ✅ build (构建)
   - ✅ deploy (部署)

### 4. 访问网站

部署完成后，访问：
**https://lian-yang.github.io/ltools/**

## ⚙️ 配置说明

### VitePress 配置

在 `website/docs/.vitepress/config.ts` 中：

```typescript
export default defineConfig({
  base: '/ltools/',  // 重要：必须与仓库名匹配
  // ...其他配置
})
```

### GitHub Actions 权限

工作流需要以下权限（已在配置中设置）：

```yaml
permissions:
  contents: read    # 读取代码
  pages: write      # 写入 Pages
  id-token: write   # OIDC 认证
```

## 🔧 自定义域名（可选）

如果你有自己的域名：

### 1. 添加自定义域名

1. 在仓库 Settings → Pages → Custom domain
2. 输入你的域名，如 `ltools.yourdomain.com`
3. 等待 DNS 检查完成

### 2. 配置 DNS

在你的域名服务商添加 CNAME 记录：

```
ltools.yourdomain.com → lian-yang.github.io
```

### 3. 更新 VitePress 配置

```typescript
export default defineConfig({
  base: '/',  // 改为根路径
  // ...
})
```

## 🐛 常见问题

### 问题 1: 404 错误

**原因**: base 路径配置不正确

**解决**:
- 确保 `base: '/ltools/'` 与仓库名匹配
- 如果使用自定义域名，改为 `base: '/'`

### 问题 2: 部署失败

**检查步骤**:
1. 查看 Actions 日志
2. 确认 Node.js 版本兼容（需要 18+）
3. 检查 package-lock.json 是否存在

### 问题 3: 样式/图片加载失败

**原因**: 资源路径问题

**解决**:
- 使用相对路径引用资源
- 图片放在 `public/` 目录
- 确保路径以 `/ltools/` 开头

### 问题 4: 工作流未触发

**检查**:
- 确认修改了 `website/` 目录下的文件
- 检查分支是否为 main
- 尝试手动触发工作流

## 📊 部署流程图

```
代码推送 → GitHub Actions 触发
    ↓
安装依赖 (npm ci)
    ↓
构建网站 (vitepress build)
    ↓
上传构建产物
    ↓
部署到 GitHub Pages
    ↓
网站上线 ✅
```

## 📝 更新网站

### 修改文档

1. 编辑 `website/docs/` 下的 `.md` 文件
2. 提交并推送
3. 等待自动部署（约 2-3 分钟）

### 修改配置

1. 编辑 `website/docs/.vitepress/config.ts`
2. 本地测试：`npm run docs:dev`
3. 构建测试：`npm run docs:build`
4. 提交并推送

### 添加新页面

1. 创建新的 `.md` 文件
2. 在 `config.ts` 中添加导航/侧边栏配置
3. 提交并推送

## 🔗 相关链接

- [GitHub Pages 官方文档](https://docs.github.com/en/pages)
- [VitePress 部署指南](https://vitepress.dev/guide/deploy#github-pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

## ✅ 验证清单

- [ ] GitHub Pages 已启用
- [ ] Source 设置为 GitHub Actions
- [ ] 工作流运行成功
- [ ] 网站可以访问
- [ ] 所有链接正常
- [ ] 样式正确加载
- [ ] 搜索功能正常

---

配置完成后，每次推送代码到 main 分支，网站都会自动更新！🎉

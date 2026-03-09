# GitHub Pages 快速配置

## 第一步：启用 GitHub Pages

1. 打开浏览器，访问：**https://github.com/lian-yang/ltools/settings/pages**

2. 在 **Build and deployment** → **Source** 下拉菜单中：
   - ❌ 不要选择 "Deploy from a branch"
   - ✅ 选择 **"GitHub Actions"**

3. 页面会自动刷新，显示配置成功

## 第二步：触发首次部署

### 方式 A：手动触发（推荐）

1. 访问：**https://github.com/lian-yang/ltools/actions/workflows/deploy-website.yml**
2. 点击右侧的 **"Run workflow"** 按钮
3. 在弹出框中选择 `main` 分支
4. 点击绿色的 **"Run workflow"** 按钮

### 方式 B：推送代码触发

任何对 `website/` 目录的修改都会自动触发部署。

## 第三步：查看部署进度

1. 访问：**https://github.com/lian-yang/ltools/actions**
2. 点击最新的工作流运行
3. 等待两个任务完成（约 2-3 分钟）：
   - ✅ build
   - ✅ deploy

## 第四步：访问网站

部署完成后，访问：

**https://lian-yang.github.io/ltools/**

🎉 完成！

---

## 常见问题

**Q: 访问网站显示 404？**
- 等待几分钟让部署完成
- 检查 base 路径配置是否为 `/ltools/`

**Q: 如何更新网站？**
- 修改 `website/docs/` 下的文件
- 推送到 main 分支
- 自动部署

**Q: 如何查看构建日志？**
- Actions 标签 → 点击工作流 → 查看详细日志

**Q: 部署失败怎么办？**
- 查看 Actions 日志定位错误
- 检查 Node.js 版本（需要 18+）
- 确认 package-lock.json 存在

---

需要详细说明？查看 [完整配置指南](./GITHUB_PAGES_SETUP.md)

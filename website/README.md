# LTools 官网

这是 LTools 产品官网的 VitePress 项目。

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run docs:dev

# 构建生产版本
npm run docs:build

# 预览构建结果
npm run docs:preview
```

## 部署

网站会自动部署到 GitHub Pages：

1. 推送到 main 分支的 `website/` 目录更改会触发部署
2. GitHub Actions 会自动构建和部署
3. 访问地址：https://lian-yang.github.io/ltools/

## 目录结构

```
website/
├── docs/              # VitePress 文档目录
│   ├── .vitepress/   # VitePress 配置
│   ├── public/       # 静态资源
│   ├── guide/        # 用户指南
│   ├── plugins/      # 插件文档
│   ├── dev/          # 开发文档
│   └── index.md      # 首页
├── package.json      # 项目配置
└── README.md         # 本文件
```

## 添加新页面

1. 在相应的目录创建 `.md` 文件
2. 在 `.vitepress/config.ts` 中添加导航和侧边栏配置
3. 编写内容

## 修改配置

编辑 `.vitepress/config.ts` 文件来修改：
- 网站标题和描述
- 导航菜单
- 侧边栏结构
- 社交链接

## 许可证

MIT

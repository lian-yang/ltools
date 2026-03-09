# 开发环境搭建

本指南将帮助你搭建 LTools 的开发环境。

## 系统要求

### 必需

- **Go** 1.25 或更高版本
- **Node.js** 18.0 或更高版本
- **npm** 或 **pnpm**

### 可选

- **Task** - 任务运行器（推荐）
- **Wails CLI** - `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### 平台特定要求

#### macOS

- Xcode 命令行工具: `xcode-select --install`

#### Windows

- WebView2 运行时（通常已预装）
- MinGW-w64（用于 CGO）

#### Linux

- GCC
- GTK3 开发库
- WebKit2GTK 开发库

Ubuntu/Debian:
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
```

Fedora:
```bash
sudo dnf install gtk3-devel webkit2gtk3-devel
```

## 克隆仓库

```bash
git clone https://github.com/lian-yang/ltools.git
cd ltools
```

## 安装依赖

### Go 依赖

```bash
go mod download
```

### 前端依赖

```bash
cd frontend
npm install
# 或
pnpm install
cd ..
```

## 开发模式

### 使用 Task (推荐)

```bash
# 启动开发服务器（前后端热重载）
task dev
```

### 使用 Wails CLI

```bash
# 启动开发服务器
wails3 dev -config ./build/config.yml -port 9245
```

开发模式特性：
- 前端热重载
- 后端自动重建
- 自动生成 TypeScript 绑定

## 构建生产版本

### 当前平台

```bash
task build
# 或
wails3 build
```

### 特定平台

```bash
# macOS
task darwin:build

# Windows
task windows:build

# Linux
task linux:build
```

## 生成绑定

当修改了后端服务的导出方法后，需要重新生成 TypeScript 绑定：

```bash
task common:generate:bindings
# 或
wails3 generate bindings -clean=true -ts
```

绑定文件生成在 `frontend/bindings/` 目录。

## 项目结构

```
ltools/
├── main.go                 # 应用入口
├── go.mod/go.sum          # Go 依赖
├── Taskfile.yml           # 构建任务
├── internal/              # 内部包
│   └── plugins/          # 插件核心框架
├── plugins/              # 内置插件实现
├── frontend/             # React 前端
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── hooks/        # Hooks
│   │   └── router/       # 路由
│   └── bindings/         # 自动生成的绑定
├── build/                # 构建配置
└── docs/                 # 文档
```

## 常见问题

### 前端绑定未更新

如果修改了后端服务但前端看不到更新：

```bash
task common:generate:bindings
```

### 热重载不工作

尝试重启开发服务器，或检查端口是否被占用。

### 构建失败

1. 确保所有依赖已安装
2. 清理构建缓存: `rm -rf build/bin frontend/dist`
3. 重新构建

## 下一步

- [插件开发](./plugin-development) - 学习如何创建插件
- [架构设计](./architecture) - 了解项目架构
- [API 参考](./api-reference) - 查看可用 API

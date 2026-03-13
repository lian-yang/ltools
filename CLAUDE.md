# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

**LTools** 是一个基于 **Wails v3** (alpha) 的插件化跨平台桌面工具箱应用。类似于 uTools 的设计理念，通过插件架构提供统一的工具集中心。

### 核心定位
- 面向开发者和高级用户的插件化桌面工具箱
- 跨平台支持（macOS、Windows、Linux、iOS、Android）
- 全局搜索和快捷键快速访问工具
- 系统托盘集成，后台运行

### 核心技术栈
- **后端**：Go 1.25+ 与 Wails v3 框架
- **前端**：React 18.2 + TypeScript 5.2 + Vite 5 + TailwindCSS 4
- **构建系统**：Task (taskfiles) + Wails CLI
- **全局快捷键**：robotn/gohook 库

## 开发命令

### 核心开发
```bash
# 以开发模式运行（前端和后端热重载）
task dev
# 或
wails3 dev -config ./build/config.yml -port 9245

# 生产构建
task build
wails3 build

# 仅运行前端开发服务器（端口 9245）
cd frontend && npm run dev
```

### 前端构建
```bash
cd frontend
npm run build          # 生产构建
npm run build:dev      # 开发构建（无压缩）
```

### 服务器模式（无头 HTTP 服务器）
```bash
task build:server      # 构建服务器二进制文件
task run:server        # 运行服务器模式
```

### 跨平台构建
```bash
# 平台特定构建（由 {{OS}} 自动检测）
task darwin:build      # macOS
task windows:build     # Windows
task linux:build       # Linux
task ios:build         # iOS
task android:build     # Android
```

### 绑定生成
```bash
# 为 Go 服务生成 TypeScript 绑定
task common:generate:bindings
# 或
wails3 generate bindings -clean=true -ts
```

## 项目架构

### 整体目录结构
```
ltools/
├── main.go                 # 应用入口点、窗口设置、服务注册
├── go.mod/go.sum          # Go 依赖
├── Taskfile.yml           # 构建任务运行器配置
├── internal/              # 内部插件系统架构
│   └── plugins/          # 核心插件框架
├── plugins/              # 内置插件实现
│   ├── applauncher/     # 应用启动器
│   ├── calculator/      # 计算器
│   ├── clipboard/       # 剪贴板管理
│   ├── datetime/        # 日期时间显示
│   ├── jsoneditor/      # JSON 编辑器
│   ├── processmanager/  # 进程管理器
│   ├── screenshot/      # 截图工具
│   └── sysinfo/         # 系统信息
├── frontend/            # React + TypeScript 前端
│   ├── src/
│   │   ├── router/           # React Router v6 路由系统
│   │   │   ├── routes/       # 路由配置
│   │   │   ├── guards/       # 路由守卫（插件生命周期）
│   │   │   └── layouts/      # 布局组件
│   │   ├── pages/            # 页面组件
│   │   ├── windows/          # 独立窗口组件
│   │   ├── hooks/            # 自定义 Hooks
│   │   └── components/       # UI 组件
│   ├── bindings/             # 自动生成的 Wails 绑定（请勿编辑）
│   └── dist/                 # 构建后的前端资源
├── build/              # 构建配置
│   ├── config.yml      # 应用配置
│   └── Taskfile.yml    # 构建任务
├── docs/              # 文档
└── bin/               # 编译后的二进制文件
```

### 服务模式

Wails v3 使用**基于服务的架构**。后端功能通过服务暴露给前端：

1. **创建服务**：定义一个带有导出方法的 Go 结构体
   ```go
   type MyService struct{}
   func (s *MyService) DoSomething(input string) string { ... }
   ```

2. **注册服务**：在 `main.go` 中将其添加到 `application.Options.Services`
   ```go
   Services: []application.Service{
       application.NewService(&MyService{}),
   }
   ```

3. **生成绑定**：运行 `task common:generate:bindings` 在 `frontend/bindings/` 中创建 TypeScript 绑定

4. **从前端调用**：导入并使用生成的绑定
   ```typescript
   import { MyService } from './bindings'
   await MyService.DoSomething("hello")
   ```

## 插件系统架构

### 核心设计模式

插件系统使用基于接口的清洁架构：

#### 1. 插件接口 (`internal/plugins/plugin.go`)

```go
type Plugin interface {
    Metadata() *PluginMetadata
    Init(app *application.App) error
    ServiceStartup(app *application.App) error
    ServiceShutdown(app *application.App) error
    Enabled() bool
    SetEnabled(enabled bool) error
}
```

**插件元数据结构：**
- `ID`：唯一标识符（格式：`<name>.builtin`，如 `datetime.builtin`）
- `Name`：显示名称
- `Version`：语义版本
- `Author`：插件作者
- `Description`：功能描述
- `Type`：插件类型（BuiltIn、Web、Native）
- `State`：状态（Installed、Enabled、Disabled、Error）
- `Permissions`：所需权限（filesystem、network、clipboard 等）
- `Keywords`：搜索关键词
- `ShowInMenu`：UI 可见性控制
- `HasPage`：是否有独立页面视图

#### 2. 插件管理器 (`internal/plugins/manager.go`)

**核心职责：**
- 插件注册和生命周期管理
- 与持久化注册表的状态同步
- 权限检查和授予
- 批量操作（启动全部、关闭全部）
- 插件发现和搜索

**重要特性：**
- 使用 `sync.RWMutex` 保证线程安全
- 通过 `Registry` 实现持久化状态
- 从上次会话自动恢复状态
- 优雅关闭处理

#### 3. 插件注册表 (`internal/plugins/registry.go`)

**存储位置：** `~/.ltools/plugins.json`

**操作：**
- 加载/保存插件元数据
- 跨会话保持插件状态
- 带关键词匹配的搜索功能
- 冲突检测

#### 4. 权限系统 (`internal/plugins/permissions.go`)

**可用权限：**
- `PermissionFileSystem`：文件系统访问
- `PermissionNetwork`：网络操作
- `PermissionClipboard`：剪贴板访问
- `PermissionNotification`：系统通知
- `PermissionProcess`：进程管理

### 开发新插件的标准流程

```go
// 1. 创建插件结构体
type MyPlugin struct {
    *plugins.BasePlugin
    app *application.App
}

// 2. 实现构造函数
func NewMyPlugin() *MyPlugin {
    metadata := &plugins.PluginMetadata{
        ID:          "myplugin.builtin",
        Name:        "我的插件",
        Version:     "1.0.0",
        Type:        plugins.PluginTypeBuiltIn,
        State:       plugins.PluginStateInstalled,
        Description: "插件功能描述",
        Keywords:    []string{"搜索", "关键词"},
    }
    return &MyPlugin{
        BasePlugin: plugins.NewBasePlugin(metadata),
    }
}

// 3. 创建服务（如果有前端交互）
type MyPluginService struct {
    plugin *MyPlugin
    app    *application.App
}

func NewMyPluginService(plugin *MyPlugin, app *application.App) *MyPluginService {
    return &MyPluginService{plugin: plugin, app: app}
}

// 4. 在 main.go 中注册
plugin := myplugin.NewMyPlugin()
pluginManager.Register(plugin)
service := myplugin.NewMyPluginService(plugin, app)
app.RegisterService(application.NewService(service))
```

## 内置插件说明

### DateTime 插件 (`plugins/datetime/`)
实时时钟和日期显示

**发出的事件：**
- `datetime:current`、`datetime:time`、`datetime:date`
- `datetime:datetime`、`datetime:weekday`
- `datetime:year`、`datetime:month`、`datetime:day`
- `datetime:hour`、`datetime:minute`、`datetime:second`

### Calculator 插件 (`plugins/calculator/`)
基础和科学计算

**功能：**
- 基本四则运算
- 表达式求值
- 百分比计算

### Clipboard 插件 (`plugins/clipboard/`)
剪贴板历史管理

**功能：**
- 自动剪贴板监控（500ms 轮询）
- 历史记录限制（默认：100 条）
- 项目删除和搜索

**发出的事件：**
- `clipboard:new`、`clipboard:cleared`、`clipboard:deleted`
- `clipboard:count`、`clipboard:heartbeat`
- `clipboard:permission:requested`

**调试日志：** `~/Library/Application Support/ltools/logs/clipboard-debug.log` (macOS) 或 `~/.config/ltools/logs/clipboard-debug.log` (Linux)

### Screenshot 插件 (`plugins/screenshot/`)
屏幕捕获和标注（微信风格）

**组件：**
- `capture.go`：屏幕捕获功能
- `window_service.go`：独立编辑器窗口
- 平台特定窗口管理

**发出的事件：**
- `screenshot:started`、`screenshot:captured`
- `screenshot:saved`、`screenshot:copied`
- `screenshot:cancelled`、`screenshot:error`

### System Info 插件 (`plugins/sysinfo/`)
系统硬件和运行时信息

**提供的数据：**
- CPU 使用率和型号
- 内存使用量
- 磁盘使用量
- 系统运行时间
- Go 运行时指标

### JSON Editor 插件 (`plugins/jsoneditor/`)
JSON 格式化和验证

**功能：**
- JSON 格式化/美化
- 语法验证
- Monaco Editor 集成

### Process Manager 插件 (`plugins/processmanager/`)
查看和管理系统进程

**功能：**
- 进程列表显示
- 进程终止
- 资源使用显示

### App Launcher 插件 (`plugins/applauncher/`)
快速应用启动

**功能：**
- 应用发现
- 按名称搜索
- 与全局搜索集成

## 事件系统

### 事件命名规范
- 格式：`<plugin>:<action>`
- 示例：`datetime:time`、`clipboard:new`
- 使用连字符表示复合操作

### 后端（发送）
```go
// 在 init() 中注册事件类型
application.RegisterEvent[string]("myevent:data")

// 发送事件
app.Event.Emit("myevent:data", "payload")
```

### 前端（监听）
```typescript
import { Events } from '@wailsio/runtime';

// 监听事件
Events.On('myevent:data', (ev: { data: string }) => {
    console.log(ev.data);
});
```

## 快捷键系统

### 架构设计

**两层架构：**

1. **ShortcutManager**：快捷键绑定的持久化存储
   - 文件：`~/.ltools/shortcuts.json`
   - 组合键规范化
   - 冲突检测

2. **ShortcutService**：运行时快捷键注册
   - 使用 `gohook` 库实现全局热键
   - 回退到 Wails KeyBinding API
   - 平台特定格式化（macOS: ⌘, Windows: Win）

### 默认快捷键
- `Cmd+5` / `Ctrl+5`：打开全局搜索
- `Cmd+Shift+S` / `Ctrl+Shift+S`：截图

### 全局热键实现

**使用 `robotn/gohook`：**
- 系统级热键支持
- 可靠的键检测（rawcode 映射）
- 调试日志：`/tmp/gohook_debug.log`

**键映射要点：**
- 数字键使用小键盘位置 rawcode（0-5: 0x53-0x57, 6-9: 0x31-0x34）
- 修饰键：Cmd (0x37, 0x3B)、Shift (0x38, 0x3C)、Alt (0x3A, 0x3D)、Ctrl (0x36, 0x3E）

## 前端架构

### 技术栈

**核心：**
- React 18.2 + TypeScript 5.2
- React Router v6 路由管理
- Vite 5 构建工具
- TailwindCSS 4 样式
- `@wailsio/runtime` Go 绑定

**开发配置：**
- 路径别名（`@/*` → `./src/*`）
- TypeScript 严格模式
- 热模块替换

### 设计系统 (`frontend/src/styles.css`)

**主题：** 玻璃态 + 深色开发者主题

**色彩方案：**
- 主色：#7C3AED (Violet 紫色)
- 背景：#0D0F1A (深色)
- 文本：#FAF5FF (灰白色)
- 成功：#22C55E、警告：#F59E0B、错误：#EF4444

**玻璃效果：**
```css
.glass          /* 基础玻璃：60% 不透明度，12px 模糊 */
.glass-light    /* 轻量玻璃：40% 不透明度，8px 模糊 */
.glass-heavy    /* 重度玻璃：85% 不透明度，20px 模糊 */
```

**字体：**
- 标题：Space Grotesk
- 正文：DM Sans
- 自定义滚动条样式

### 组件架构

**核心组件：**
1. `Icon.tsx`：SVG 图标系统（基于 Heroicons）
2. `PluginMarket.tsx`：插件发现和管理
3. `SearchWindow.tsx`：全局搜索界面
4. `Settings.tsx`：应用设置
5. `Toast.tsx`：通知系统
6. `PermissionDialog.tsx`：权限请求

**插件小部件：**
- `DateTimeWidget.tsx`：实时时钟显示
- `CalculatorWidget.tsx`：计算器 UI
- `ClipboardWidget.tsx`：剪贴板历史查看器
- `JSONEditorWidget.tsx`：基于 Monaco 的 JSON 编辑器
- `ProcessManagerWidget.tsx`：进程列表界面
- `ScreenshotWidget.tsx`：截图控制
- `SystemInfoWidget.tsx`：系统统计显示

**自定义 Hooks：**
- `usePlugins()`：插件列表、启用/禁用、搜索
- `usePlugin(id)`：单个插件详情
- `useDateTime()`：日期时间特定功能
- `useToast()`：通知管理
- `useGlobalShortcuts()`：全局快捷键事件监听和导航

### 路由和导航

**技术栈：** React Router v6

**路由架构：**
```
frontend/src/router/
├── index.tsx              # 路由入口，检测窗口类型
├── types.ts               # 路由类型定义
├── routes/
│   ├── mainRoutes.tsx     # 主应用路由（首页、插件、设置）
│   └── windowRoutes.tsx   # 独立窗口路由（搜索、截图、贴图）
├── guards/
│   └── pluginGuard.tsx    # 插件生命周期守卫
└── layouts/
    └── MainLayout.tsx     # 主布局（侧边栏 + Outlet）
```

**URL 格式：**
- 首页：`/`
- 插件市场：`/plugins`
- 设置：`/settings`
- 插件页面：`/plugins/{pluginId}`（如 `/plugins/clipboard.builtin`）
- 搜索窗口：`/search`
- 截图覆盖层：`/screenshot2-overlay`
- 贴图窗口：`/pin-window?id={windowId}`

**布局结构：**
- `MainLayout`：侧边栏 + Outlet 嵌套路由
- 独立窗口：无侧边栏的简化路由

**导航系统：**
- `Sidebar` 组件使用 `useNavigate` 和 `useLocation`
- 动态插件菜单项从启用的插件自动生成
- 插件视图缓存通过组件结构保持状态

**插件生命周期守卫：**
- `PluginGuard` 统一管理插件的 enter/leave 回调
- 支持 `registerPluginLifecycle()` 注册自定义处理函数

## 多窗口管理

### 窗口类型

1. **主窗口**：主应用界面（使用 MainLayout）
2. **搜索窗口**：无边框、始终置顶的搜索（Spotlight/Alfred 风格）
3. **截图覆盖层**：全屏截图和标注工具
4. **贴图窗口**：悬浮图片显示窗口

### 窗口通信
- 基于事件的消息传递
- 窗口引用用于显示/隐藏
- 坐标共享用于定位

## 配置文件

### 应用配置 (`build/config.yml`)

```yaml
info:
  productName: "LTools"
  productIdentifier: "com.ltools.app"
  description: "多功能开发工具集"
  version: "0.1.0"

dev_mode:
  log_level: warn
  debounce: 1000
  ignore:
    dir: [.git, node_modules, frontend, bin]
    file: [.DS_Store, .gitignore]
    watched_extension: ["*.go", "*.js", "*.ts"]
```

### 持久化数据
- `~/.ltools/plugins.json`：插件状态
- `~/.ltools/shortcuts.json`：快捷键绑定

## 重要说明

### Wails v3 Alpha 状态
- 这是 alpha 版本软件；API 可能会变化
- 文档：https://v3.wails.io/
- 社区：https://discord.gg/JDdSxwjhGf

### 开发模式配置
- 开发模式行为在 `build/config.yml` 的 `dev_mode` 部分配置
- Vite 开发服务器运行在端口 9245（可通过 `WAILS_VITE_PORT` 环境变量配置）
- 文件监视忽略：`.git`、`node_modules`、`frontend`、`bin`

### 平台特定说明
- **macOS**：需要 Xcode 命令行工具；全局热键需要辅助功能权限
- **Windows**：需要 WebView2 运行时
- **iOS**：需要 macOS + Xcode
- **Android**：需要 Android SDK/NDK

### 调试基础设施
- 剪贴板调试：`~/Library/Application Support/ltools/logs/clipboard-debug.log` (macOS)
- 全局热键调试：`/tmp/gohook_debug.log`

### 命名约定
- **插件 ID**：格式 `<name>.builtin`（如 `datetime.builtin`）
- **事件名称**：格式 `<plugin>:<action>`（如 `datetime:time`）
- **Go 文件**：使用 snake_case（如 `search_window_service.go`）
- **TypeScript 文件**：使用 PascalCase 或 kebab-case（组件用 PascalCase）

### 错误处理模式
- Goroutine 中的 panic 恢复
- 优雅降级（热键回退）
- 用户友好的错误消息
- 调试日志用于故障排除

### 性能考虑
- 插件状态缓存
- 事件防抖（默认 1000ms）
- 骨架屏加载
- 重型组件懒加载

## 文档资源

**项目文档：**
- `docs/design/plugin-system.md`：插件架构设计
- `docs/DESIGN_SYSTEM.md`：UI/UX 设计系统
- `docs/WAILS_WINDOW_BEHAVIOR.md`：窗口管理
- `docs/keycode/`：键映射参考

**外部资源：**
- Wails v3：https://v3.wails.io/
- Wails Discord：https://discord.gg/JDdSxwjhGf
- React：https://react.dev/
- TailwindCSS：https://tailwindcss.com/

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ltools** (4262 symbols, 8913 relationships, 228 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/ltools/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ltools/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ltools/clusters` | All functional areas |
| `gitnexus://repo/ltools/processes` | All execution flows |
| `gitnexus://repo/ltools/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->

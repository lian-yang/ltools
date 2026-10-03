# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

> 前端部分于 2026-10-03 对照源码、依赖锁文件及生产构建核对。UI 已采用 v2「精密仪器」设计系统；重写记录见 `frontend/REWRITE_PROGRESS.md`，其中历史验收记录不能代替当前版本的运行验证。

## 项目概述

**LTools** 是一个基于 **Wails v3** (alpha) 的插件化跨平台桌面工具箱应用。类似于 uTools 的设计理念，通过插件架构提供统一的工具集中心。

### 核心定位
- 面向开发者和高级用户的插件化桌面工具箱
- 跨平台支持（macOS、Windows、Linux、iOS、Android）
- 全局搜索和快捷键快速访问工具
- 系统托盘集成，后台运行

### 核心技术栈
- **后端**：Go 1.25.2 与 Wails v3.0.0-alpha.74（以 `go.mod` 为准）
- **前端**：React 18 + TypeScript 5 + React Router 7 + Vite 6 + TailwindCSS 4（实际版本以 `frontend/package-lock.json` 为准）
- **构建系统**：Task (taskfiles) + Wails CLI
- **全局快捷键**：Windows 使用 `golang.design/x/hotkey`；其他桌面平台使用 robotn/gohook

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

# 仅运行前端开发服务器（显式指定 Wails 使用的端口）
cd frontend && npm run dev -- --port 9245 --strictPort
```

### 前端构建
```bash
cd frontend
npm run build          # 生产构建
npm run build:dev      # 开发构建（无压缩）
npx tsc --noEmit       # 仅 TypeScript 检查
npm run dev:mock       # 浏览器 mock 模式入口，支持部分服务，见下文
```

直接执行 `npm run dev` / `npm run dev:mock` 不固定为 9245；端口参数由 `task dev` 的前端任务传入。需要固定端口时加 `-- --port 9245 --strictPort`。

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
│   ├── screenshot2/     # 截图、标注与贴图工具
│   └── sysinfo/         # 系统信息
│                        # 另含看板、便签、书签、密码库、音乐、图片处理等插件
├── frontend/            # React + TypeScript 前端
│   ├── src/
│   │   ├── router/           # React Router v7 路由系统
│   │   │   ├── routes/       # 路由配置
│   │   │   ├── guards/       # 路由守卫（插件生命周期）
│   │   │   └── layouts/      # 布局组件
│   │   ├── pages/            # 页面组件
│   │   ├── windows/          # 独立窗口组件
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── plugins/          # 插件加载、权限与 usePlugins/usePlugin/useDateTime
│   │   ├── dev/              # 浏览器 mock transport
│   │   └── components/       # 工具组件；ui/ 为共享 UI Kit
│   ├── bindings/             # 自动生成的 Wails 绑定（请勿编辑）
│   ├── DESIGN.md             # 前端设计规范（UI 改动前必读）
│   ├── REWRITE_PROGRESS.md   # 重写记录与当前核对结论
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
   // 路径相对于 frontend/src 中的文件，按实际生成的服务目录导入。
   import * as CalculatorService from '../bindings/ltools/plugins/calculator/calculatorservice'
   await CalculatorService.Evaluate('1 + 2')
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

### Screenshot2 插件 (`plugins/screenshot2/`)
屏幕捕获和标注（微信风格）

**组件：**
- `capture.go`：屏幕捕获功能
- `window_manager.go`：截图覆盖层及窗口管理
- `pin_window.go`：贴图窗口
- 平台特定窗口管理

**发出的事件：**
- 使用 `screenshot2:*` 事件命名空间，具体事件及载荷以服务和窗口管理实现为准

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
- 设置 → 快捷键 → 全局搜索：可录制替换组合、恢复默认；保存后立即注册，启动时仅在没有用户配置时添加默认组合。
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

### 当前基线与验证边界

- UI 重写已落到源码；2026-10-03 复核 `tsc` 与 Vite 生产构建通过。构建仍提示 `PluginPage` 大分包及图片处理绑定同时被静态/动态导入。
- 搜索采用 uTools 风格大输入框与分组结果：仅搜索命中的应用使用 100×100 方形格和真实应用图标；最近使用、插件与文件为文字行。右上角应用图标可点击返回主界面；失去窗口焦点自动隐藏。支持中文、完整拼音、首字母、模糊匹配、方向键、IME、字面量高亮、防抖与过期响应丢弃。
- Windows 图标通过系统 ExtractIconExW 提取 exe/ico 资源，编码为 PNG data URI；已验证非空图像、资源索引和环境变量路径。没有可用图标时显示通用图案。
- 浏览器 mock 回归已验证搜索布局、390px 无溢出、键盘导航、文件展开/收起、三种主题、快捷键保存与恢复、Markdown XSS 与公式。Windows 原生验收通过真实中文应用、拼音/首字母、ChatGPT、图标、失焦隐藏、主界面入口和正常 Node 退出；完整逐页验收仍待补。
- 文件结果放在最后，按匹配度排序，默认显示 5 项。索引扫描常用用户目录、重定向目录、OneDrive 及 Windows Search，受 30 秒扫描时限和 100000 条上限约束，不等同于 SwiftList 的全盘 USN/MFT 索引。
- Windows 应用枚举使用 Unicode 注册表和 Get-StartApps；Store 应用可通过 AppsFolder 启动并提取 Shell 图标。本机探测 215 个应用、214 个真实 PNG 图标。
- Windows 辅助命令使用 `processutil.Background` 隐藏控制台，音乐服务正常退出时停止并回收 Node；不保证强制结束父进程时的清理。
- 全局 WebView 不得设置 `--disable-web-security` 或证书绕过参数。Ollama 检测通过后端 `DetectOllamaModels` 完成；音乐使用同源音频/图片代理，Range/图片专项测试通过。原生验证跨源 iframe 与 CORS 读取被阻止。
- 真实后端、多窗口、系统权限、音频播放及歌词滚动需在 `task dev` 下验证；纯前端构建不证明这些功能可用。

### 技术栈

**核心：**
- React 18 + TypeScript 5
- React Router v7 路由管理（源码中部分 v6 注释尚未更新）
- Vite 6 构建工具
- TailwindCSS 4 样式
- `@wailsio/runtime` Go 绑定

2026-10-03 锁文件版本：React 18.3.1、TypeScript 5.9.3、React Router 7.18.4、Vite 6.4.3、TailwindCSS 4.1.18、`@wailsio/runtime` 3.0.0-alpha.79。不要用 `package.json` 中的最低版本当作实际安装版本。

**开发配置：**
- 路径别名（`@/*` → `./src/*`）
- TypeScript 严格模式
- 热模块替换

### 设计系统 v2「精密仪器」

**UI 改动前先读 `frontend/DESIGN.md`**；`docs/DESIGN_SYSTEM.md` 是速览，`frontend/src/styles.css` 是 token 与组件类实现。

- 表面：`surface-0..4` 五档石墨色阶，不透明结构层与 1px `hairline` 边框。
- 强调色：钴蓝 `#0A84FF`，只用于主操作、选中态和焦点；成功/警告/错误使用语义色。
- 文本：`text-text-1..4` 四档，禁止回到 `text-white/*`、紫色渐变、发光阴影与 emoji 图标。
- 字体：系统 UI 字体栈，无 Google Fonts 外链；代码用 `font-mono`，动态数字用 `tnum`。
- 密度与圆角：13px 基准字号、19px 页面标题、4px 间距网格；控件 6px、卡片 9px、模态 12px。
- 动效：120/180/240ms、`--ease-out`、按压反馈与 `prefers-reduced-motion`；不新增 `transition-all` 或 hover 位移辉光。
- 阴影和模糊仅用于悬浮层。搜索窗保留毛玻璃；模态遮罩、截图浮动工具栏也有模糊，不能宣称全应用只有一处。
- `.glass` / `.glass-light` / `.glass-heavy` 是旧类名的**兼容别名**，现已映射到新表面 token，`backdrop-filter: none`；不是旧玻璃主题的入口。

### 组件架构

**核心组件：**
1. `components/ui/index.tsx`：共享 UI Kit，17 个原语（Button、IconButton、Card、Field、Toggle、Badge、KeyCap、Segmented、Modal、EmptyState、Spinner、Skeleton、ProgressBar 等）
2. `Icon.tsx`：项目内维护的 lucide 风格 SVG 图标表，配合 `getPluginIconName()` 使用；当前没有 `lucide-react` 依赖
3. `PluginMarket.tsx`：插件发现和管理
4. `SearchWindow.tsx` / `SearchWindow.css`：全局搜索界面
5. `Settings.tsx` / `SettingsNav.tsx`：应用设置与分类导航
6. `Toast.tsx` / `contexts/ToastContext.tsx`：通知系统
7. `PermissionDialog.tsx`：权限请求

按钮、表单、状态反馈优先复用 UI Kit；选择器用 `components/ui/select.tsx`。图标用现有 `Icon`，不要在页面里另建图标体系。

**插件小部件：**
- `DateTimeWidget.tsx`：实时时钟显示
- `CalculatorWidget.tsx`：计算器 UI
- `ClipboardWidget.tsx`：剪贴板历史查看器
- `JSONEditorWidget.tsx`：基于 Monaco 的 JSON 编辑器
- `ProcessManagerWidget.tsx`：进程列表界面
- `Screenshot2Widget.tsx` / `components/Screenshot2/`：截图控制、覆盖层与标注
- `SystemInfoWidget.tsx`：系统统计显示

另含 `kanban/`、`vault/`、`imageprocessor/` 子模块，以及书签、便签、图床、IP 信息、本地翻译、密码生成与音乐播放器；音乐主实现位于 `widgets/MusicPlayerWidget.tsx`。

**自定义 Hooks：**
- `usePlugins()`：插件列表、启用/禁用、搜索
- `usePlugin(id)`：单个插件详情
- `useDateTime()`：日期时间特定功能
- `useToast()`：通知管理
- `useGlobalShortcuts()`：全局快捷键事件监听和导航

### 路由和导航

**技术栈：** React Router v7

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
- 便签窗口：`/sticky-window?id={noteId}`
- 翻译窗口：`/localtranslate-window`
- 音乐窗口：`/music-player`

**布局结构：**
- `MainLayout`：侧边栏 + Outlet 嵌套路由
- 独立窗口：无侧边栏的简化路由

**导航系统：**
- `Sidebar` 组件使用 `useNavigate` 和 `useLocation`
- 动态插件菜单项从启用的插件自动生成
- `PluginPage` 按当前 `pluginId` 渲染单个 `PluginContent`；虽然有 `isActive`/`hidden` 与 KeepAlive 注释，当前调用始终传 `true`，没有多插件缓存容器。不要依赖切页后状态自动保留。
- 普通工具复用 `StandardPluginLayout`；看板、Markdown、密码库、书签、IP 信息等使用专用布局，不是全部插件统一套标准布局。

**插件生命周期守卫：**
- `PluginGuard` 统一管理插件的 enter/leave 回调
- 支持 `registerPluginLifecycle()` 注册自定义处理函数

### 绑定与浏览器 mock

- 实际绑定目录为 **`frontend/bindings/`**，不在 `frontend/src/bindings/`。Vite 插件、TypeScript include 和组件导入均指向该目录。
- 从仓库根运行 `task common:generate:bindings` 或 `wails3 generate bindings -clean=true -ts`；不要从 `frontend/` 执行根目录生成命令，以免写到嵌套目录。
- 生成文件不能手改；服务方法、枚举、模型和调用 ID 以 Go 服务重新生成的结果为准。
- `npm run dev:mock` 加载 `.env.mock` 中的 `VITE_MOCK=1`；`main.tsx` 只在 `DEV && VITE_MOCK === '1'` 时加载 `src/dev/mockTransport.ts`。仅设 `MOCK=1` 不会启用。
- mock 用 TypeScript AST 从生成绑定解析 `methodID` 到命名空间服务方法，当前生成绑定为 319 个方法；未知方法显式报错。搜索/设置和部分工具有 handler，音乐 `ServiceLX` 提供空数据状态；不能用 mock 证明真实音频、后端或系统集成可用。

### 已知待办

- 完成 `frontend/QA_PAGES.md` 的逐页及原生功能验收；浏览器回归范围见上文。
- `GeneralSettings` 的语言切换仍提示“正在开发中”；主题已支持深色、浅色、跟随系统，持久化并跨窗口同步。Monaco 和 Markdown 预览代码高亮跟随主题。
- Markdown 预览使用 raw → sanitize → KaTeX(trust=false) → highlight；HTML 导出再次经 Go bluemonday 清洗并添加禁用脚本/框架 CSP。安全及脚注/公式兼容测试通过，修改策略时必须保留这些回归检查。
- `TunnelWidget` 已改为依赖稳定的 toast 回调，避免重复订阅。
- `go test ./...` 仍有既有失败：图片处理测试缺少 `writeTestPNGWithSize`，插件管理测试的注册后状态预期与实现不一致。Markdown 与搜索快捷键专项测试通过。
- `music-note` / `shuffle` / `crop` / `compress` 图标尚未收录，README 截图仍需核对更新。
- 图片批处理 `startTime` 是 Go `Unix()` 秒，前端乘 1000；处理结果 `duration` 是毫秒。当前耗时单位匹配，无需仅因单位疑虑改动。

## 多窗口管理

### 窗口类型

1. **主窗口**：主应用界面（使用 MainLayout）
2. **搜索窗口**：无边框、始终置顶的搜索（Spotlight/Alfred 风格）
3. **截图覆盖层**：全屏截图和标注工具
4. **贴图窗口**：悬浮图片显示窗口
5. **便签、翻译、音乐窗口**：各自独立的工具界面

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
  version: "0.1.5"

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
- `task dev` 的前端任务默认传入端口 9245（可通过 `WAILS_VITE_PORT` 配置）；直接运行 Vite 脚本需自行指定端口
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
- 不假设插件视图已有 KeepAlive 缓存；切页时需明确状态与事件的生命周期
- 事件防抖（默认 1000ms）
- 骨架屏加载
- 重型组件懒加载

## 文档资源

**项目文档：**
- `frontend/DESIGN.md`：当前前端设计规范（UI 改动前必读）
- `frontend/REWRITE_PROGRESS.md`：重写记录与当前核对结论
- `frontend/QA_PAGES.md`：浏览器页面验收清单
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

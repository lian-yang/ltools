# LTools UI 全面重写 — 进度总结

> 日期:2026-10-03
> 状态:**本轮搜索、安全与快捷键修复已落地并完成回归**。2026-10-03 已生成 Windows NSIS 试用安装包；浏览器和 Windows 原生热键测试通过。本文不替代真实音频、系统权限和逐页验收。

## 当前核对结果(2026-10-03)

| 核对项 | 当前结果与证据 |
|---|---|
| TypeScript 与生产构建 | `npm run build` 通过(`tsc` + Vite 6.4.3);保留 PluginPage 大分包及图片处理静态/动态导入重叠警告 |
| 设计系统 | `DESIGN.md`、`src/styles.css`、`docs/DESIGN_SYSTEM.md` 已采用 v2「精密仪器」;UI Kit 实际导出 17 个原语 |
| 搜索窗口 | 搜索命中的应用为 100×100 方形真实图标格；插件、文件、最近使用为文字行；右上角应用图标可返回主界面，失去焦点自动隐藏。防抖、过期响应、特殊字符、IME、方向键和移动端回归通过 |
| 绑定 | 实际在 `frontend/bindings/`,当前共 85 个文件(其中 `ltools/` 77 个),使用 `$Call.ByID(...)`;不在 `src/bindings/` |
| 浏览器 mock | AST 映射生成绑定的 319 个 methodID；搜索、设置和部分工具 handler 可用，音乐服务为空状态。不能替代真实后端或音频验收 |
| 路由与布局 | 依赖为 React Router 7.18.4;部分工具有独立布局。`PluginPage` 当前只渲染单个 `PluginContent` 并始终传 `isActive=true`,没有多插件 KeepAlive 缓存容器 |
| 批处理耗时 | Go `StartTime: time.Now().Unix()` 为秒,前端乘 1000;`Duration` 使用 `Milliseconds()`,当前单位匹配 |
| 页面与原生验收 | 浏览器 QA 通过搜索布局、文件展开、主题同步、快捷键、Markdown XSS/公式；Windows 原生热键与搜索窗口验收通过，含真实应用、失焦隐藏、主界面入口、同源/CORS 隔离和 Node 正常退出。完整音频/逐页验收仍待补。 |

### 本轮交付补充

- `SearchWindow.tsx` / `SearchWindow.css`: uTools 风格大输入框；仅应用结果使用小正方形真实图标，其他结果使用文本行；右上角 LTools 应用图标可返回主界面，搜索窗失去焦点自动隐藏。
- Windows 原图标提取占位实现已改为系统 ExtractIconExW → PNG；exe/ico 非空图像、资源索引与环境变量路径专项测试通过。
- 本机只读探测 215 个已安装应用，提取到 214 个真实 PNG 图标；没有可用资源的使用通用图案。启动采用 ShellExecute 并去除图标资源索引。
- 全局搜索快捷键显示在设置顶部，可录制、保存、恢复 Ctrl+5；保存立即替换运行时注册，配置写入 `shortcuts.json`，Windows 支持系统级后台热键并正确报告冲突。
- Markdown 预览和 HTML 导出均清洗主动内容，同时保留页内锚点、脚注、KaTeX 颜色和布局。
- 搜索支持中文、完整拼音、首字母和模糊匹配；文件放在最后一个分组，按匹配度排序，默认显示 5 项，其余展开。索引覆盖常用用户目录、重定向目录、OneDrive 及 Windows Search，受 30 秒和 100000 条上限约束，并非全盘 USN/MFT 索引；本机已验证命中文档。
- 深色、浅色和跟随系统主题已经落地，持久化并跨窗口同步；Monaco 和 Markdown 代码高亮跟随主题。
- Windows 辅助命令隐藏控制台；音乐服务正常退出时停止并回收 Node。不保证强制结束父进程时的清理。
- 去除了全局 WebView 的 `--disable-web-security` 和错误使用的证书参数；Ollama 模型检测移至后端。原生验证跨源 iframe/CORS 读取被阻止，音乐 Range/封面代理专项测试通过。
- Windows 原生搜索验收通过微信、首字母 `wx`、ChatGPT、真实图标、失焦隐藏、主界面入口和正常 Node 退出。
- 验证：浏览器 QA、Windows 原生热键和专项 Go 测试通过；前端与音乐服务 `npm audit` 均为 0 vulnerabilities。
- 产物：`bin/ltools-amd64-installer.exe`，未签名试用包。安装器带 WebView2 bootstrapper；音乐服务需要 Node.js 16+。

以下模块交付及 BUG 列表保留为历史重写记录。当前可确认编译构建通过,不能据此推导所有功能和窗口均已验收。

---

## 一、成果总览

废弃旧的"紫罗兰玻璃拟态"主题,全面切换到新设计系统 **「精密仪器」**(参考 Raycast / Linear / Xcode 的克制风格)。

### 硬性指标(历史报告与当前复核)

| 指标 | 结果 |
|---|---|
| TypeScript 检查 | 当前生产构建中的 `tsc` **通过**;接手时缺失绑定为历史报告 |
| 生产构建 `vite build` | 当前复核**通过**(Vite 6.4.3),保留分包警告 |
| 旧主题残留 | 当前 `src` 扫描未发现 `text-white/*` 与 `#7C3AED` / `#A78BFA`;“869 行 → 0 行”为历史统计。CSS 仍有骨架屏/贴图用途的渐变,不能泛称所有渐变为 0 |
| 修复真实 BUG | 历史报告**约 40 个**(见第三节),本轮未逐项回归 |
| 页面验收 | 历史报告称 20+ 页面通过;当前 mock 和搜索样式有差异,需修复后重新执行 `QA_PAGES.md` |

### 新设计系统速览

| 维度 | 旧版(AI 味) | 新版 |
|---|---|---|
| 颜色 | 紫渐变满屏 + `text-white/*` | 石墨五档表面色阶 + 唯一钴蓝 `#0A84FF`(面积≤10%)+ 四档文本色 |
| 质感 | 玻璃拟态 + 紫色辉光 | 不透明分层 + 1px 发丝边框;阴影只给菜单/模态 |
| 字体 | Google 网络字体 | 系统栈(SF Pro/Segoe/雅黑);数据 `font-mono` + `tnum` |
| 动效 | hover-lift + 辉光 | 120–240ms ease-out,按压 `scale(0.97)`,尊重 reduced-motion |
| 图标 | emoji 混用 | 统一项目内 `Icon.tsx` 的 lucide 风格 SVG 与插件图标映射,没有引入 `lucide-react` |
| 玻璃 | 满屏 `backdrop-blur` | 结构层不透明;搜索窗、模态遮罩及截图浮动工具栏保留模糊,旧 `glass*` 类是无模糊兼容别名 |

---

## 二、改动清单(15 个模块组)

### 基础设施
- `src/styles.css` — 全新 token 体系(`--color-surface-0..4`、`--color-text-1..4`、hairline 三档、动效时长/曲线)+ 组件类(btn/input/card/row/menu/badge/kbd 等)+ 旧类名兼容别名
- `src/components/ui/index.tsx` — **UI Kit 17 个原语**:Button/IconButton/Card/PageHeader/SectionTitle/Input/Textarea/Field/Toggle/Badge/KeyCap/Segmented/Modal/EmptyState/Spinner/Skeleton/ProgressBar
- `src/components/ui/select.tsx` — radix Select token 化
- `frontend/DESIGN.md` — 设计规范(所有改动的唯一标准);`docs/DESIGN_SYSTEM.md` 同步更新
- `src/utils/pluginHelpers.ts` — 去 emoji,只保留 `getPluginIconName(): IconName`
- `index.html` — 删 Google Fonts 外链,zh-CN,防白闪

### Wails 绑定重建(关键路径)
- 历史记录称缺失绑定曾由 Go 源码重建。当前实际目录为 `frontend/bindings/`,共 **85 个文件**(其中 `ltools/` 77 个),均应以真实 `wails3 generate bindings` 输出为准,禁止手改。Vite 配置与 TypeScript include 均使用该目录。

### 壳层(本人完成)
- 侧栏(Sidebar)、MainLayout、Toast(右下角/悬浮层材质)、PermissionDialog(**原对话框引用的 CSS 类根本不存在,无样式 bug**)、UpdateNotification(紫粉渐变重灾区)、router 加载态、ui/select、Screenshot2Widget、SearchWindow(当前仅应用结果为图标网格,其他结果为文字行)

### 模块组(subagent 交付)
| 组 | 文件 | 交付要点 |
|---|---|---|
| Home | pages/Home.tsx | 仪表盘布局、ProgressBar、错误态补齐 |
| 插件市场 | Plugins/PluginMarket/PluginPage | Badge 状态体系、Segmented 过滤、21 个插件 case;普通工具复用 StandardPluginLayout,看板/Markdown/密码库等使用专用布局 |
| 设置 | 10 个文件 | 左导航+Field horizontal 表单、KeyCap、SetupWizard 分步化、修复定时器泄漏/双滚动条 |
| 工具A | DateTime/Calculator/Clipboard/JSONEditor | 计算器等宽键盘、剪贴板图标修复 |
| 工具B | SystemInfo/ProcessManager/Hosts/Tunnel | 指标卡网格、数据表对齐、日志区 mono |
| 工具C | Qrcode/Password/Markdown/LocalTranslate(+Window) | 密度条三档 tone、markdown 预览排版 token 化 |
| 看板 | 7 文件(本人) | BoardList/Column/CardEditor/dueDate RFC3339 修复、删死代码 Card.tsx |
| 便签/书签/图床 | Sticky×2/Bookmark×2/ImageBed | 纸色语义保留压暗、书签行式列表、上传区 token 化 |
| IP信息 | IPInfoWidget | 数据密集页标杆、fetchedAt 类型修复 |
| 密码库 | vault 8 文件 | Setup/Unlock 引导页(原 `bg-primary` 类失效=真 bug)、EntryCard/Editor/Sidebar |
| 图片处理 | 7 文件 | FontSelector portal 修复、双取色器修复、passive 滚轮修复 |
| 音乐播放器 | 2222→1908 行 | **ended 双重绑定跳歌修复**、预加载退避、搜索无限滚动修复、列表视图逃逸按钮 |

### 开发环境
- **`npm run dev:mock`**(`.env.mock` 中 `VITE_MOCK=1`):纯前端模式入口;methodID 分发已修复,支持部分服务,不能作为完整原生验收环境
- `src/dev/mockTransport.ts`:`setTransport` 接管 runtime 调用,AST 解析生成绑定的命名空间及调用 ID;未知调用显式报错,音乐 ServiceLX 提供空状态
- 直接运行 Vite 脚本不固定为 9245,需要该端口时加 `-- --port 9245 --strictPort`;`MOCK=1` 不被 `main.tsx` 的启用条件读取

---

## 三、历史报告的 BUG 修复(精选,本轮未逐项回归)

**数据级:**
1. 剪贴板**过滤状态下删除会误删别的条目**(下标错位,`handleDelete(index)` 直传过滤后下标)
2. 音乐播放器**每次播完跳两首歌**(`ended` 双重绑定)
3. 计算器键盘监听**劫持其他插件输入**(KeepAlive 隐藏后监听仍活,吞 `/`)
4. 搜索/过滤状态下删除进度错位(Hosts 条目平行 uid 数组方案)

**渲染级:**
5. PermissionDialog 引用不存在的 CSS 类 = 完全无样式
6. 看板 `card.labels` 未判空 → 白屏(浏览器实测抓到)
7. 系统状态卡失败时永远停在骨架屏(无错误态)
8. FontSelector 下拉被 overflow 裁剪(portal+fixed 修复)
9. 颜色选择器双弹窗(程序化 input 与原生 input 同时响应)
10. Markdown 预览隐藏时导出 HTML 为空
11. QR 大尺寸撑破容器;copied 计时器叠加
12. 图片处理裁剪滚轮 passive 失效(控制台报错+页面跟随滚动)
13. 进程/系统信息列表 key 用 index;Hosts 条目删除错位丢焦点
14. 进度条 NaN%(duration=0)、预加载失败紧密循环重试、搜索无限滚动从不触发、列表视图 z-100 困死鼠标用户
15. 多处定时器泄漏(AboutSettings/SyncSettings/ProcessManager)、`onKeyPress` 废弃 API×6、ShortcutEditor 占位文案被当已录快捷键渲染

---

## 四、遗留事项(当前核对后更新)

1. **真实运行可用 `task dev` 或生产 exe**；本轮已找到 Go/Wails/Task 并完成构建与独立配置启动。音频播放/歌词滚动、多窗口和系统权限仍待逐项验收
2. Markdown 预览与导出清洗已修复,安全与兼容专项测试通过；以后修改清洗策略须重做回归
3. GeneralSettings 语言/主题下拉仍是占位；TunnelWidget 已依赖稳定 toast 回调,FRP 调试日志已改为局部 logger,避免关闭文件后吞掉全局日志
4. mock methodID 分发已修复,音乐 ServiceLX 仅空状态；完整 `QA_PAGES.md` 仍待逐页执行
5. 可补图标:`music-note`/`shuffle`/`crop`/`compress`
6. README 截图过时,建议重截
7. 搜索布局与选中态浏览器回归已完成；原生窗口切换和应用启动需试用验收
8. `PluginPage` 大分包(~1.31 MB,压缩前)与图片处理绑定静态/动态导入重叠仍产生构建警告
9. 全仓库 Go 测试仍有既有失败：图片处理测试缺少 `writeTestPNGWithSize`，插件管理测试注册后状态预期与实现不一致；专项测试通过
10. GitNexus 影响分析已执行；目录没有 `.git`，`detect-changes` 无法生成变更报告，改用修改前备份核对差异

---

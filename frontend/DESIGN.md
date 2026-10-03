# LTools 前端设计规范 v2 —「精密仪器」

> 本文档是所有 UI 改动的唯一标准。写样式前先读完这份文档。
> 配套文件:`src/styles.css`(设计 token 与组件类)、`src/components/ui/index.tsx`(UI Kit)。

## 0. 我们在杀死什么

旧版界面被一眼认出是"AI 生成"的原因,以下全部禁止:

- ❌ 紫色渐变(`from-[#7C3AED] to-[#A78BFA]` 之类)与一切渐变按钮/图标底
- ❌ 玻璃拟态(`glass`/`backdrop-filter`)用在结构层(侧栏、卡片、页面)
- ❌ 发光阴影(`shadow-purple`、`0 0 24px rgba(124,58,237,...)`)
- ❌ `hover-lift` 位移 + 辉光
- ❌ emoji 当图标(🎯📦🕐)
- ❌ 白色透明度当文字色阶(`text-white/30`、`text-white/60`)——改用 `text-text-1/2/3/4`
- ❌ 裸 hex 颜色(`bg-[#0D0F1A]`)——改用 token
- ❌ `transition-all`、`duration-300+` 的 UI 动效
- ❌ 巨大标题(2.5rem)、松散留白、大圆角(`rounded-2xl`)

## 1. 设计基调

**像精密仪器,不像海报。** 信息密度适中、层级靠亮度差和发丝边框表达、颜色克制(强调色只出现在主操作/激活态/焦点)。参考物:Raycast、Linear、Xcode inspector——而不是 Dribbble。

## 2. Token(Tailwind v4 `@theme`,在 `styles.css`)

### 表面(由深到浅,用亮度差表达层级)
| Token | 用途 | Tailwind 类 |
|---|---|---|
| `--color-surface-0` | 应用画布 | `bg-surface-0` |
| `--color-surface-1` | 侧栏、凹陷面板、输入框底 | `bg-surface-1` |
| `--color-surface-2` | 卡片 | `bg-surface-2` |
| `--color-surface-3` | hover 提升、菜单 | `bg-surface-3` |
| `--color-surface-4` | 最高层:tooltip、激活控件 | `bg-surface-4` |

### 文本
`text-text-1`(主文)、`text-text-2`(次文)、`text-text-3`(辅助/元信息)、`text-text-4`(禁用/水印)。
层级优先用**字号+字重+颜色**三者组合,不要发明第五档。

### 边框
`border-hairline`(常规)、`border-hairline-strong`(强调)、`border-hairline-faint`(弱分割)。1px,永不加粗。

### 强调色(唯一)
`--color-accent` #0A84FF:主按钮、激活态、选中态、焦点环、链接。
衍生:`text-accent-text`(深底文字)、`bg-accent-subtle`(选中背景 13% 透明)。
**每屏强调色面积 ≤ 10%。** 拿不准就不上色。

### 语义色
`success`(绿)、`warning`(橙)、`error`(红)、`info`(青);文字用 `*-text` 变体,底色用 13% 透明(见 `.badge-*`)。

### 字体
- 界面:`--font-ui`(系统栈,含 PingFang/雅黑)。禁止引入网络字体。
- 代码/数据:`font-mono`;**所有动态数字(百分比、计数、时间)加 `tnum` 类**。

### 圆角
控件 6px(`rounded-[6px]` 或组件类)、卡片 9px、模态 12px。禁止 12px+ 的控件圆角。

### 间距
4px 网格。页面容器用 `.page`(max-w 1080px 居中)或 `.page-wide`;卡片内边距 16px(小卡 12px);区块间距 20–24px;表单行间距 12–16px。

### 阴影
只有两类:`--shadow-pop`(菜单/tooltip)、`--shadow-modal`(模态)。卡片、侧栏、按钮一律无阴影,靠边框和亮度分层。

### 动效
- 时长:120ms(hover/颜色)、180ms(下拉/小弹出)、240ms(模态)。上限 240ms。
- 曲线:`var(--ease-out)`;只动 `transform` / `opacity` / 颜色。
- 按压反馈:所有可点元件 `:active` 时 `scale(0.97)`(组件类已内置)。
- 键盘触发的动作(快捷键、搜索)不加动画。
- 尊重 `prefers-reduced-motion`(styles.css 已全局处理)。

## 3. UI Kit(`src/components/ui`)

导入:`import { Button, IconButton, Card, PageHeader, SectionTitle, Input, Textarea, Field, Toggle, Badge, KeyCap, Segmented, Modal, EmptyState, Spinner, Skeleton, ProgressBar } from '@/components/ui'`(或相对路径 `../components/ui`)。

| 组件 | 要点 |
|---|---|
| `Button` | `variant: primary/secondary/ghost/danger/danger-solid`,`size: sm/md/lg`,`icon`、`loading` |
| `IconButton` | `name`(IconName)、`label`(必填,无障碍)、`size`、`tone: default/danger` |
| `Card` | `inset`(凹陷面板)、`hover`(可交互卡) |
| `PageHeader` | 页头:标题 19px + 副标题 + 右侧 actions |
| `SectionTitle` | 区块标题(12px 灰) + 右侧 action |
| `Input/Textarea` | 统一 `.input` 类;搜索框配 `<Icon name="search">` 前缀时用相对定位包裹 |
| `Field` | 表单行:`horizontal` 模式 = 左标签右控件(设置页) |
| `Toggle` | 开关 34×20px,替代一切手写 checkbox 开关 |
| `Badge` | `tone: neutral/accent/success/warning/error` |
| `KeyCap` | 快捷键键帽,替代 `.shortcut-key` |
| `Segmented` | 分段切换器(替代手写 tab 按钮) |
| `Modal` | 居中模态:`title`、`footer`、`width`;Esc/点遮罩关闭 |
| `EmptyState` | `icon + title + description + action` |
| `Spinner/Skeleton/ProgressBar` | `tone` 可选 |

## 4. 布局规则

- **页面结构**:`.page` → `PageHeader` → 内容区块。列表页可以 `.page-wide`。
- **设置类页面**:左侧分类导航(160–200px,`.card-inset`)+ 右侧表单(`Field horizontal` 行 + `.hairline-b` 分隔),不要卡片套卡片。
- **数据列表**:用 `.row` + `.row-clickable`/`.row-selected`,行高 32–40px,不要卡片包每一行。
- **工具栏/头部**: sticky 时 `bg-surface-0/90 backdrop-blur` 可接受(悬浮层材质的正确用法)。
- **滚动**:页面级滚动在 `<main>`,组件内滚动加 `scrollbar-hide` 或细滚动条,必须能滚到底、不双滚动条。
- **空/加载/错误态**:每个列表和面板三态齐全(EmptyState/Skeleton/错误提示+重试)。
- **响应式**:主窗口最小宽度按 900px 设计,但 flex/grid 必须不炸(有 min-w-0、truncate)。

## 5. 图标

- 一律 `<Icon name="..." size={...} />`,继承 currentColor。
- 新 IconName 直接加到 `components/Icon.tsx` 的联合类型与路径表(24×24 viewBox,1.5px 线宽,圆帽——与现有风格一致)。
- 插件图标用 `pluginHelpers.getPluginIconName()`,确保每个插件都有真图标,**emoji 分支一律删除**。

## 6. 改造约束(硬性)

1. **不改业务逻辑**:hooks、状态流、绑定调用、事件名、props 签名、localStorage key 全部保持。
2. **不改文件名/导出名**,除非任务指明。
3. 删除发现的死代码与本组件内不再使用的样式;**不要删除 .bak 文件之外的文件**(统一清理)。
4. 中文文案保持中文;错误提示、按钮文案风格:简洁、动词开头("复制"、"清空历史")。
5. 每改完一个文件,自查:无裸 hex、无 text-white/*、无 emoji 图标、无渐变、无 backdrop-blur(悬浮层除外)、无 transition-all、焦点可达。
6. **发现 BUG 必须修**:布局溢出、z-index 冲突、双滚动条、事件未解绑、空指针渲染(undefined.x)、截断失效、按钮无 disabled 态、列表 key 用 index 等。修不了的记录到返回报告。

## 7. 自查清单(提交前逐条过)

- [ ] 页面在 900×600 与 1440×900 下都不破版
- [ ] 键盘 Tab 顺序合理,焦点环可见
- [ ] 空态/加载态/错误态齐全
- [ ] 数字用 `tnum`,代码用 `font-mono`
- [ ] 按钮有 hover + active + disabled 三态
- [ ] 强调色面积 ≤ 10%,无渐变无辉光
- [ ] 文案层级:一屏最多一个 19px 标题

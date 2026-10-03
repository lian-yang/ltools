# LTools UI 设计系统 v2 —「精密仪器」

> 详细规范与改动守则见 [`frontend/DESIGN.md`](../frontend/DESIGN.md)。
> Token 与组件类实现见 [`frontend/src/styles.css`](../frontend/src/styles.css)。
> UI Kit 见 [`frontend/src/components/ui/index.tsx`](../frontend/src/components/ui/index.tsx)。

## 设计基调

**像精密仪器,不像海报。** 信息密度适中,层级靠表面亮度差与发丝边框表达,颜色克制。
参考物:Raycast、Linear、Xcode inspector。

v1(紫罗兰玻璃拟态)整体废弃:紫色渐变、`backdrop-filter` 结构层、发光阴影、
`text-white/*` 文本色阶、emoji 图标、Google 网络字体一律不再使用。

## 核心决策速览

| 维度 | 决策 |
|---|---|
| 表面 | `--color-surface-0..4` 五档石墨色阶(画布 → 卡片 → 悬浮),全部不透明 |
| 边框 | 1px 发丝线 `--color-hairline(-strong/-faint)`,层级靠亮度差不靠阴影 |
| 强调色 | 唯一:`#0A84FF`(系统蓝),面积 ≤ 10%;衍生 `accent-text` / `accent-subtle` |
| 语义色 | `success` 绿 / `warning` 橙 / `error` 红 / `info` 青(Apple 深色系统色) |
| 文本 | `--color-text-1..4` 四档,不再用白色透明度 |
| 字体 | 系统栈(SF Pro / Segoe UI / PingFang / 雅黑),零网络字体;数据 `font-mono` + `tnum` |
| 圆角 | 控件 6px / 卡片 9px / 模态 12px |
| 密度 | 4px 网格,基准字号 13px,页面标题 19px |
| 阴影 | 仅两类:`--shadow-pop`(菜单/tooltip)、`--shadow-modal`(模态) |
| 动效 | 120/180/240ms,`--ease-out`,只动 transform/opacity/颜色,按压 `scale(0.97)` |
| 玻璃 | 仅悬浮窗(全局搜索窗)与浮层工具栏可用;`prefers-reduced-motion` 全局尊重 |

## 组件规范

所有按钮、输入框、卡片、开关、徽章、空态、骨架屏、模态、进度条、键帽
统一从 UI Kit(`@/components/ui`)取用,禁止页面内手写同类元件。
图标统一 `components/Icon.tsx`(lucide 风格,24 viewBox / stroke 2)。

## 纯前端开发模式

无 Go 后端时可用假数据驱动 UI(截图验收、样式开发):

```bash
cd frontend
npm install
npm run dev:mock     # 等价于 vite --mode mock(VITE_MOCK=1)
```

原理:`src/dev/mockTransport.ts` 通过 `@wailsio/runtime` 的 `setTransport`
拦截全部绑定调用并返回模拟数据;真实构建不受影响。

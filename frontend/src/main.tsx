import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouter } from './router'
import './styles.css'
import './hooks/useTheme'

/**
 * 应用入口
 * 使用 React Router v6 统一管理路由
 *
 * 纯前端开发模式:MOCK=1 npx vite(或 VITE_MOCK=1)时启用后端数据 mock,
 * 便于在没有 Go 后端的情况下做 UI 开发与视觉验收。
 */
async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === '1') {
    const { enableWailsMock } = await import('./dev/mockTransport')
    enableWailsMock()
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <AppRouter />
    </React.StrictMode>,
  )
}

bootstrap()

import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouter } from './router'
import { I18nProvider } from './i18n'
import './styles.css'

/**
 * 应用入口
 * 使用 React Router v6 统一管理路由
 * I18nProvider 覆盖主窗口与全部独立子窗口（均经由 AppRouter 挂载）
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <AppRouter />
    </I18nProvider>
  </React.StrictMode>,
)

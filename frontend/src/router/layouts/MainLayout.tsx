import { Outlet } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { Sidebar } from '../../components/navigation/Sidebar'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { UpdateNotification } from '../../widgets/UpdateNotificationWidget'

// Re-export IconName for use in other files
export type { IconName } from '../types'

/**
 * 主布局组件
 * 包含侧边栏和主内容区域
 */
export function MainLayout() {
  // 初始化全局快捷键监听
  useGlobalShortcuts()

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[#0D0F1A] text-[#FAF5FF]">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 主内容区 - 由子路由填充 */}
        <main className="flex-1 overflow-auto relative">
          <Outlet />
        </main>
      </div>

      {/* 更新通知组件（全局） */}
      <UpdateNotification />
    </ToastProvider>
  )
}

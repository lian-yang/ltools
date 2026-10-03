import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Events } from '@wailsio/runtime'
import { ToastProvider } from '../../contexts/ToastContext'
import { Sidebar } from '../../components/navigation/Sidebar'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { UpdateNotification } from '../../widgets/UpdateNotificationWidget'
import * as SearchWindowService from '../../../bindings/ltools/internal/plugins/searchwindowservice'

// Re-export IconName for use in other files
export type { IconName } from '../types'

/**
 * 主布局组件
 * 包含侧边栏和主内容区域
 */
export function MainLayout() {
  const navigate = useNavigate()

  // 初始化全局快捷键监听
  useGlobalShortcuts()

  // 监听来自后端的全局导航事件
  useEffect(() => {
    const unsubscribe = Events.On('navigate:to', (ev: any) => {
      console.log('[MainLayout] Received navigate:to event:', ev)
      const data = ev.data as { path: string; tab?: string }
      if (data.path) {
        // 构建完整的 URL（包含查询参数）
        const url = data.tab ? `${data.path}?tab=${data.tab}` : data.path
        navigate(url, { replace: false })
      }
    })

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [navigate])

  // 监听文件打开事件（文件关联）
  useEffect(() => {
    const unsubscribe = Events.On('file:open', async (ev: any) => {
      const filePath = ev.data as string
      console.log('[MainLayout] File opened:', filePath)

      // 检查文件扩展名
      if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
        // 导航到 markdown 插件页面并传递文件路径
        navigate(`/plugins/markdown.builtin?file=${encodeURIComponent(filePath)}`)
      }
    })

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [navigate])

  // 监听 URL 打开事件（自定义协议 ltools://）
  useEffect(() => {
    const unsubscribe = Events.On('url:open', (ev: any) => {
      const data = ev.data as { url: string; path: string }
      console.log('[MainLayout] URL opened:', data)

      // 解析 ltools:// URL 并导航到相应页面
      // 格式: ltools://path?query
      const path = data.path
      const questionMarkIndex = path.indexOf('?')
      const pathname = questionMarkIndex > 0 ? path.substring(0, questionMarkIndex) : path
      const queryString = questionMarkIndex > 0 ? path.substring(questionMarkIndex + 1) : ''

      // 根据路径导航
      if (pathname === 'settings') {
        // ltools://settings?tab=about
        const params = new URLSearchParams(queryString)
        const tab = params.get('tab')
        const url = tab ? `/settings?tab=${tab}` : '/settings'
        navigate(url)
      } else if (pathname.startsWith('plugins/')) {
        // ltools://plugins/{pluginId}?param=xxx
        navigate(`/${pathname}${queryString ? '?' + queryString : ''}`)
      } else if (pathname === 'search') {
        // ltools://search?q=keyword
        // 打开独立的搜索窗口，而不是在主窗口中导航
        const params = new URLSearchParams(queryString)
        const q = params.get('q') || ''
        console.log('[MainLayout] Opening search window with query:', q)
        SearchWindowService.ShowWithQuery(q).catch(err => {
          console.error('[MainLayout] Failed to open search window:', err)
        })
      } else {
        // 其他路径，直接导航
        navigate(`/${pathname}${queryString ? '?' + queryString : ''}`)
      }
    })

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [navigate])

  return (
    <ToastProvider>
      <div className="flex h-screen bg-surface-0 text-text-1">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 主内容区 - 由子路由填充 */}
        <main className="relative flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* 更新通知组件（全局） */}
      <UpdateNotification />
    </ToastProvider>
  )
}

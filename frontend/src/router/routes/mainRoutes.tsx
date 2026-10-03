import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { PluginGuard } from '../guards/pluginGuard'
import type { RouteConfig } from '../types'

// 懒加载页面组件
const Home = lazy(() => import('../../pages/Home'))
const Plugins = lazy(() => import('../../pages/Plugins'))
const Settings = lazy(() => import('../../pages/Settings'))
const PluginPage = lazy(() => import('../../pages/PluginPage'))

/**
 * 加载中组件
 */
function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="spinner" />
    </div>
  )
}

/**
 * 懒加载包装器
 */
function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  )
}

/**
 * 主应用路由配置
 */
export const mainRoutes: RouteConfig[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: (
          <LazyWrapper>
            <Home />
          </LazyWrapper>
        ),
      },
      {
        path: 'plugins',
        element: (
          <LazyWrapper>
            <Plugins />
          </LazyWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <LazyWrapper>
            <Settings />
          </LazyWrapper>
        ),
      },
      {
        path: 'plugins/:pluginId',
        element: (
          <PluginGuard>
            <LazyWrapper>
              <PluginPage />
            </LazyWrapper>
          </PluginGuard>
        ),
      },
      // 默认重定向到首页
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]

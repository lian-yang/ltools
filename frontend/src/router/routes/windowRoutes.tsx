import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RouteConfig } from '../types'

// 懒加载窗口组件
const SearchWindow = lazy(() => import('../../windows/SearchWindow'))
const Screenshot2Overlay = lazy(() => import('../../windows/Screenshot2Overlay'))
const PinWindowComponent = lazy(() => import('../../windows/PinWindow'))
const StickyWindowComponent = lazy(() => import('../../windows/StickyWindow'))
const LocalTranslateWindowComponent = lazy(() => import('../../windows/LocalTranslateWindow'))
const MusicPlayerWindowComponent = lazy(() => import('../../windows/MusicPlayerWindow'))

/**
 * PinWindow 包装器 - 从 URL 参数获取 windowId
 */
function PinWindowWrapper() {
  const [searchParams] = useSearchParams()
  const windowId = parseInt(searchParams.get('id') || '0', 10)
  return <PinWindowComponent windowId={windowId} />
}

/**
 * StickyWindow 包装器 - 组件内部从 URL 参数获取 id
 */
function StickyWindowWrapper() {
  return <StickyWindowComponent />
}

/**
 * LocalTranslateWindow 包装器
 */
function LocalTranslateWindowWrapper() {
  return <LocalTranslateWindowComponent />
}

/**
 * MusicPlayerWindow 包装器
 */
function MusicPlayerWindowWrapper() {
  return <MusicPlayerWindowComponent />
}

/**
 * 加载中组件（窗口版本 - 全屏）
 */
function WindowLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[#0D0F1A]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C3AED]"></div>
    </div>
  )
}

/**
 * 懒加载包装器
 */
function LazyWindowWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<WindowLoadingFallback />}>
      {children}
    </Suspense>
  )
}

/**
 * 独立窗口路由配置
 * 这些路由不包含侧边栏，是独立的窗口视图
 */
export const windowRoutes: RouteConfig[] = [
  {
    path: '/search',
    element: (
      <LazyWindowWrapper>
        <SearchWindow />
      </LazyWindowWrapper>
    ),
  },
  {
    path: '/screenshot2-overlay',
    element: (
      <LazyWindowWrapper>
        <Screenshot2Overlay />
      </LazyWindowWrapper>
    ),
  },
  {
    path: '/pin-window',
    element: (
      <LazyWindowWrapper>
        <PinWindowWrapper />
      </LazyWindowWrapper>
    ),
  },
  {
    path: '/sticky-window',
    element: (
      <LazyWindowWrapper>
        <StickyWindowWrapper />
      </LazyWindowWrapper>
    ),
  },
  {
    path: '/localtranslate-window',
    element: (
      <LazyWindowWrapper>
        <LocalTranslateWindowWrapper />
      </LazyWindowWrapper>
    ),
  },
  {
    path: '/music-player',
    element: (
      <LazyWindowWrapper>
        <MusicPlayerWindowWrapper />
      </LazyWindowWrapper>
    ),
  },
]

/**
 * 判断当前路径是否为窗口路由
 */
export function isWindowPath(path: string): boolean {
  return path === '/search' || path === '/screenshot2-overlay' || path === '/pin-window' || path === '/sticky-window' || path === '/localtranslate-window' || path === '/music-player'
}

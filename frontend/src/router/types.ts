/**
 * 图标名称类型 — 以 components/Icon.tsx 的定义为准,避免两处脱节
 */
import type { IconName } from '../components/Icon'
export type { IconName }

/**
 * 基础路由配置接口
 */
export interface RouteConfig {
  path: string
  element: React.ReactNode
  children?: RouteConfig[]
}

/**
 * 插件路由配置接口
 */
export interface PluginRouteConfig extends RouteConfig {
  pluginId: string
  hasPage?: boolean
}

/**
 * 导航项配置
 */
export interface NavItem {
  id: string
  label: string
  icon: IconName
  path: string
  pluginId?: string
  pinned?: boolean // 是否固定
}

/**
 * 插件生命周期处理函数类型
 */
export type PluginLifecycleHandler = (pluginId: string) => Promise<void>

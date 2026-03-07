/**
 * 图标名称类型
 */
export type IconName = 'home' | 'puzzle-piece' | 'clock' | 'cog' | 'key' | 'shield-check' | 'funnel' |
  'check-circle' | 'x-circle' | 'exclamation-circle' | 'information-circle' |
  'search' | 'chevron-down' | 'chevron-right' | 'external-link' | 'refresh' | 'plus' | 'minus' |
  'clipboard' | 'document' | 'copy' | 'sparkles' | 'cube' | 'keyboard' | 'command' |
  'calculator' | 'cpu' | 'memory' | 'disk' | 'network' | 'server' | 'chip' |
  'code' | 'alert-circle' | 'check' | 'download' | 'upload' | 'process' | 'close' |
  'trash' | 'x-mark' | 'camera' | 'qrcode' | 'folder' | 'folder-open' | 'wrench' |
  'arrow-left' | 'arrow-right' | 'stop' | 'play' | 'pencil' | 'log' | 'terminal' |
  'view-columns' | 'pin'

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

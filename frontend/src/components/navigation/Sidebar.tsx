import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '../Icon'
import { usePlugins } from '../../plugins/usePlugins'
import { PluginState } from '../../../bindings/ltools/internal/plugins'
import * as PluginService from '../../../bindings/ltools/internal/plugins/pluginservice'
import type { NavItem } from '../../router/types'
import { getPluginIconName } from '../../utils/pluginHelpers'

/**
 * 基础导航项配置
 */
const baseNavItems: NavItem[] = [
  { id: 'home', label: '首页', icon: 'home', path: '/' },
  { id: 'plugins', label: '插件市场', icon: 'puzzle-piece', path: '/plugins' },
  { id: 'settings', label: '设置', icon: 'cog', path: '/settings' },
]

/**
 * 侧边栏组件
 */
export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  // 获取已启用的插件用于动态菜单
  const { plugins, loadPlugins } = usePlugins()
  const enabledPlugins = useMemo(() => {
    return plugins.filter(p => p.state === PluginState.PluginStateEnabled)
  }, [plugins])

  // 切换固定状态
  const handleTogglePin = async (pluginId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发导航
    try {
      await PluginService.TogglePin(pluginId)
      // 手动刷新插件列表以触发重新渲染
      await loadPlugins()
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  // 动态生成菜单项(基础菜单 + 已启用的插件)
  const { pinnedItems, normalItems } = useMemo(() => {
    const filtered = enabledPlugins.filter(
      p => p.hasPage !== false && p.showInMenu !== false
    )

    const pinnedPlugins = filtered.filter(p => p.pinned === true)
    const normalPlugins = filtered.filter(p => p.pinned !== true)

    // 固定插件排序:按 PinnedAt 降序(最新固定的在前)→ Score 降序 → 名称升序
    const sortPinnedPlugins = (a: any, b: any) => {
      if (a.pinnedAt && b.pinnedAt) {
        const timeDiff = new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
        if (timeDiff !== 0) return timeDiff
      } else if (a.pinnedAt) {
        return -1
      } else if (b.pinnedAt) {
        return 1
      }
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    // 普通插件排序:按 Score 降序 → 名称升序
    const sortNormalPlugins = (a: any, b: any) => {
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    const toNavItem = (plugin: any): NavItem => ({
      id: `plugin-${plugin.id}`,
      label: plugin.name,
      icon: getPluginIconName(plugin),
      path: `/plugins/${plugin.id}`,
      pluginId: plugin.id,
      pinned: plugin.pinned === true,
    })

    return {
      pinnedItems: pinnedPlugins.sort(sortPinnedPlugins).map(toNavItem),
      normalItems: normalPlugins.sort(sortNormalPlugins).map(toNavItem),
    }
  }, [enabledPlugins])

  // 根据当前路径确定活动的导航项
  const getActiveId = (): string => {
    const path = location.pathname
    if (path === '/') return 'home'
    if (path === '/plugins') return 'plugins'
    if (path === '/settings') return 'settings'
    if (path.startsWith('/plugins/')) {
      const pluginId = path.replace('/plugins/', '')
      return `plugin-${pluginId}`
    }
    return 'home'
  }

  const activeId = getActiveId()

  const renderItem = (item: NavItem) => {
    const isPlugin = !!item.pluginId
    const pluginData = isPlugin ? plugins.find(p => p.id === item.pluginId) : null
    const isPinned = pluginData?.pinned === true
    const isActive = activeId === item.id

    return (
      <button
        key={item.id}
        className={`group relative flex h-[32px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left transition-colors duration-150 clickable ${
          isActive
            ? 'bg-accent-subtle text-accent-text'
            : 'text-text-2 hover:bg-white/[0.045] hover:text-text-1'
        }`}
        onClick={() => navigate(item.path)}
      >
        <Icon name={item.icon} size={16} className="shrink-0" />
        <span className="flex-1 truncate text-[12.5px] font-medium">{item.label}</span>

        {/* 插件固定功能 */}
        {isPlugin && (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-opacity duration-150 ${
              isPinned && !isActive
                ? 'text-text-3'
                : isPinned
                  ? 'text-accent-text'
                  : 'opacity-0 group-hover:opacity-100'
            }`}
            role="button"
            tabIndex={-1}
            onClick={(e) => handleTogglePin(item.pluginId!, e)}
            title={isPinned ? '取消固定' : '固定到顶部'}
          >
            <Icon name={isPinned ? 'pin' : 'pin'} size={13} />
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-hairline bg-surface-1">
      {/* Logo 区域 */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-hairline-strong bg-surface-3">
          <Icon name="cube" size={16} color="var(--color-accent-text)" />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight text-text-1">LTools</div>
          <div className="text-[10.5px] leading-tight text-text-4">插件式工具箱</div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-hide px-2 pb-3 pt-1">
        {renderItem(baseNavItems[0])}
        {renderItem(baseNavItems[1])}

        {pinnedItems.length > 0 && (
          <>
            <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-medium text-text-4">已固定</div>
            {pinnedItems.map(renderItem)}
          </>
        )}

        {normalItems.length > 0 && (
          <>
            <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-medium text-text-4">插件</div>
            {normalItems.map(renderItem)}
          </>
        )}
      </nav>

      {/* 设置(固定在底部) */}
      <div className="border-t border-hairline px-2 py-2">
        {renderItem(baseNavItems[2])}
      </div>
    </aside>
  )
}

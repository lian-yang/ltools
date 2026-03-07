import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '../Icon'
import { usePlugins } from '../../plugins/usePlugins'
import { PluginState } from '../../../bindings/ltools/internal/plugins'
import * as PluginService from '../../../bindings/ltools/internal/plugins/pluginservice'
import type { IconName, NavItem } from '../../router/types'

/**
 * 基础导航项配置
 */
const baseNavItems: NavItem[] = [
  { id: 'home', label: '首页', icon: 'home', path: '/' },
  { id: 'plugins', label: '插件市场', icon: 'puzzle-piece', path: '/plugins' },
  { id: 'settings', label: '设置', icon: 'cog', path: '/settings' },
]

/**
 * 根据插件 ID 获取对应的图标
 */
const getPluginIconName = (pluginId: string): IconName => {
  const iconMap: Record<string, IconName> = {
    'calculator.builtin': 'calculator',
    'clipboard.builtin': 'clipboard',
    'jsoneditor.builtin': 'code',
    'processmanager.builtin': 'process',
    'sysinfo.builtin': 'cpu',
    'qrcode.builtin': 'qrcode',
    'hosts.builtin': 'server',
    'tunnel.builtin': 'network',
    'datetime.builtin': 'clock',
    'screenshot2.builtin': 'camera',
    'password.builtin': 'key',
    'kanban.builtin': 'view-columns',
  }
  return iconMap[pluginId] || 'puzzle-piece'
}

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

  // hover 状态
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

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

  // 动态生成菜单项（基础菜单 + 已启用的插件）
  const navItems = useMemo(() => {
    // 固定菜单项：首页和插件市场
    const items: NavItem[] = [baseNavItems[0], baseNavItems[1]]

    // 过滤并分类插件
    const filteredPlugins = enabledPlugins.filter(
      p => p.hasPage !== false && p.showInMenu !== false
    )

    // 分离固定插件和普通插件
    const pinnedPlugins = filteredPlugins.filter(p => p.pinned === true)
    const normalPlugins = filteredPlugins.filter(p => p.pinned !== true)

    // 固定插件排序：按 PinnedAt 降序（最新固定的在前）→ Score 降序 → 名称升序
    const sortPinnedPlugins = (a: any, b: any) => {
      // 先按固定时间降序
      if (a.pinnedAt && b.pinnedAt) {
        const timeDiff = new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
        if (timeDiff !== 0) return timeDiff
      } else if (a.pinnedAt) {
        return -1 // a 有固定时间，排前面
      } else if (b.pinnedAt) {
        return 1 // b 有固定时间，排前面
      }

      // 然后按 Score 降序
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (scoreDiff !== 0) return scoreDiff

      // 最后按名称升序
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    // 普通插件排序：按 Score 降序 → 名称升序
    const sortNormalPlugins = (a: any, b: any) => {
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    // 添加固定插件
    pinnedPlugins.sort(sortPinnedPlugins).forEach(plugin => {
      items.push({
        id: `plugin-${plugin.id}`,
        label: plugin.name,
        icon: getPluginIconName(plugin.id),
        path: `/plugins/${plugin.id}`,
        pluginId: plugin.id,
        pinned: true,
      })
    })

    // 添加普通插件
    normalPlugins.sort(sortNormalPlugins).forEach(plugin => {
      items.push({
        id: `plugin-${plugin.id}`,
        label: plugin.name,
        icon: getPluginIconName(plugin.id),
        path: `/plugins/${plugin.id}`,
        pluginId: plugin.id,
        pinned: false,
      })
    })

    // 固定菜单项：设置（始终在最后）
    items.push(baseNavItems[2])

    return items
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

  return (
    <aside className="w-64 glass border-r border-white/10 flex flex-col">
      {/* Logo 区域 */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <Icon name="cube" size={20} color="white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">LTools</h1>
            <p className="text-xs text-white/50">插件式工具箱</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isHovered = hoveredItem === item.id
          const isPlugin = !!item.pluginId
          const pluginData = isPlugin ? plugins.find(p => p.id === item.pluginId) : null
          const isPinned = pluginData?.pinned === true

          return (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 clickable group ${
                activeId === item.id
                  ? 'bg-[#7C3AED]/20 text-[#A78BFA] border border-[#7C3AED]/30'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <Icon name={item.icon} size={20} />
              <span className="flex-1 font-medium text-left">{item.label}</span>

              {/* 插件固定功能 */}
              {isPlugin && (
                <div className="flex items-center">
                  {/* 已固定且非 hover：显示固定图标 */}
                  {isPinned && !isHovered && (
                    <Icon name="pin" size={16} className="text-[#A78BFA]" />
                  )}

                  {/* Hover 时显示操作按钮 */}
                  {isHovered && (
                    <button
                      className={`p-1 rounded transition-all duration-200 ${
                        isPinned
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-white/40 hover:text-[#A78BFA]'
                      }`}
                      onClick={(e) => handleTogglePin(item.pluginId!, e)}
                      title={isPinned ? '取消固定' : '固定到顶部'}
                    >
                      <Icon name={isPinned ? 'x-mark' : 'pin'} size={14} />
                    </button>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

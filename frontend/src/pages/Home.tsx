import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { usePlugins } from '../plugins/usePlugins'
import { getPluginIcon, getPluginIconName } from '../utils/pluginHelpers'
import { PluginMetadata, PluginState } from '../../bindings/ltools/internal/plugins'
import { SysInfoService } from '../../bindings/ltools/plugins/sysinfo'
import { Events } from '@wailsio/runtime'

// ==================== 类型定义 ====================

interface SystemStatus {
  cpu: number
  memory: number
  uptime: string
}

// ==================== 子组件 ====================

/**
 * 加载骨架屏组件
 */
function LoadingSkeleton() {
  return (
    <div className="p-6 min-h-full animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧主区域骨架 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="h-7 bg-white/10 rounded w-24 mb-2 animate-pulse" />
            <div className="h-4 bg-white/10 rounded w-40 mb-4 animate-pulse" />
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="glass-light rounded-xl p-3 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-white/10 mx-auto mb-2" />
                  <div className="h-3 bg-white/10 rounded w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* 右侧边栏骨架 */}
          <div className="space-y-4">
            <div className="glass-light rounded-xl p-4 h-48 animate-pulse" />
            <div className="glass-light rounded-xl p-4 h-64 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 空状态组件 - 当没有启用的插件时显示
 */
function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="p-8 min-h-full animate-fade-in flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#A78BFA]/20 mb-6">
          <Icon name="puzzle-piece" size={36} className="text-[#A78BFA]" />
        </div>
        <h2 className="text-xl font-semibold text-white/80 mb-2">
          暂无启用的插件
        </h2>
        <p className="text-sm text-white/40 mb-6">
          启用插件后，它们将显示在这里以便快速访问
        </p>
        <button
          onClick={onBrowse}
          className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-medium transition-colors"
        >
          浏览插件
        </button>
      </div>
    </div>
  )
}

/**
 * 插件图标组件 - 优先使用专业 SVG 图标，fallback 到 emoji
 */
function PluginIcon({
  plugin,
  size = 'normal'
}: {
  plugin: PluginMetadata
  size?: 'small' | 'normal'
}) {
  const iconName = getPluginIconName(plugin)
  const emoji = getPluginIcon(plugin)

  const iconSize = size === 'small' ? 20 : 28
  const emojiSize = size === 'small' ? 'text-lg' : 'text-2xl'

  if (iconName) {
    return (
      <Icon
        name={iconName}
        size={iconSize}
        className="text-[#A78BFA]"
      />
    )
  }

  return (
    <span className={emojiSize} role="img" aria-label={plugin.name}>
      {emoji}
    </span>
  )
}

/**
 * 插件卡片组件
 */
function PluginCard({
  plugin,
  onClick,
  size = 'normal'
}: {
  plugin: PluginMetadata
  onClick: (pluginId: string) => void
  size?: 'small' | 'normal'
}) {
  if (size === 'small') {
    return (
      <button
        onClick={() => onClick(plugin.id)}
        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 group text-left w-full"
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED]/20 to-[#A78BFA]/20 flex items-center justify-center flex-shrink-0 group-hover:from-[#7C3AED]/30 group-hover:to-[#A78BFA]/30 transition-all">
          <PluginIcon plugin={plugin} size="small" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
            {plugin.name}
          </p>
          <p className="text-xs text-white/40 truncate">
            {plugin.description || '点击打开'}
          </p>
        </div>
        <Icon name="chevron-right" size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
      </button>
    )
  }

  return (
    <button
      onClick={() => onClick(plugin.id)}
      className="glass-light rounded-xl p-4 hover-lift clickable group text-center"
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED]/20 to-[#A78BFA]/20 flex items-center justify-center mx-auto mb-3 group-hover:from-[#7C3AED]/30 group-hover:to-[#A78BFA]/30 transition-all">
        <PluginIcon plugin={plugin} />
      </div>
      <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
        {plugin.name}
      </p>
    </button>
  )
}

/**
 * 最近使用组件
 */
function RecentPlugins({
  plugins,
  onPluginClick
}: {
  plugins: PluginMetadata[]
  onPluginClick: (id: string) => void
}) {
  // 获取有使用记录的插件，按最后使用时间排序
  const recentPlugins = useMemo(() => {
    return plugins
      .filter(p => p.lastUsedAt)
      .sort((a, b) => {
        const timeA = new Date(a.lastUsedAt || 0).getTime()
        const timeB = new Date(b.lastUsedAt || 0).getTime()
        return timeB - timeA
      })
      .slice(0, 5)
  }, [plugins])

  // 获取最常用插件（按分数）
  const frequentPlugins = useMemo(() => {
    return plugins
      .filter(p => (p.score || 0) > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
  }, [plugins])

  // 格式化相对时间
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 7) return `${days} 天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="glass-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
          <Icon name="clock" size={14} color="#A78BFA" />
          最近使用
        </h3>
      </div>

      {recentPlugins.length > 0 ? (
        <div className="space-y-1">
          {recentPlugins.map(plugin => (
            <div key={plugin.id} className="group">
              <PluginCard
                plugin={plugin}
                onClick={onPluginClick}
                size="small"
              />
              <p className="text-xs text-white/30 px-3 -mt-1 mb-1">
                {formatRelativeTime(plugin.lastUsedAt!)}
              </p>
            </div>
          ))}
        </div>
      ) : frequentPlugins.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-white/30 mb-2 px-1">常用工具</p>
          {frequentPlugins.map(plugin => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onClick={onPluginClick}
              size="small"
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Icon name="clock" size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-xs text-white/30">暂无使用记录</p>
        </div>
      )}
    </div>
  )
}

/**
 * 系统状态卡片
 */
function SystemStatusCard({ status }: { status: SystemStatus | null }) {
  if (!status) {
    return (
      <div className="glass-light rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="server" size={14} color="#22C55E" />
          <h3 className="text-sm font-medium text-white/60">系统状态</h3>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-8 bg-white/5 rounded" />
          <div className="h-8 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  const getCpuColor = (usage: number) => {
    if (usage > 80) return 'text-[#EF4444]'
    if (usage > 60) return 'text-[#F59E0B]'
    return 'text-[#7C3AED]'
  }

  const getCpuBg = (usage: number) => {
    if (usage > 80) return 'bg-[#EF4444]'
    if (usage > 60) return 'bg-[#F59E0B]'
    return 'bg-[#7C3AED]'
  }

  const getMemoryColor = (usage: number) => {
    if (usage > 80) return 'text-[#EF4444]'
    if (usage > 60) return 'text-[#F59E0B]'
    return 'text-[#22C55E]'
  }

  const getMemoryBg = (usage: number) => {
    if (usage > 80) return 'bg-[#EF4444]'
    if (usage > 60) return 'bg-[#F59E0B]'
    return 'bg-[#22C55E]'
  }

  return (
    <div className="glass-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
          <Icon name="server" size={14} color="#22C55E" />
          系统状态
        </h3>
        <span className="text-xs text-white/30">{status.uptime}</span>
      </div>

      {/* CPU */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Icon name="cpu" size={14} className="text-white/40" />
            <span className="text-xs text-white/50">CPU</span>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${getCpuColor(status.cpu)}`}>
            {status.cpu.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getCpuBg(status.cpu)}`}
            style={{ width: `${Math.min(status.cpu, 100)}%` }}
          />
        </div>
      </div>

      {/* Memory */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Icon name="memory" size={14} className="text-white/40" />
            <span className="text-xs text-white/50">内存</span>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${getMemoryColor(status.memory)}`}>
            {status.memory.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getMemoryBg(status.memory)}`}
            style={{ width: `${Math.min(status.memory, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ==================== 主组件 ====================

/**
 * 首页组件 - 综合仪表盘
 *
 * 布局结构:
 * ┌─────────────────────────────────┬─────────────────┐
 * │                                 │   最近使用       │
 * │      快速启动面板                ├─────────────────┤
 * │      (插件网格)                  │   系统状态       │
 * │                                 │   (CPU/内存)     │
 * └─────────────────────────────────┴─────────────────┘
 */
function Home() {
  const navigate = useNavigate()
  const { plugins, loading: pluginsLoading } = usePlugins()
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)

  // 过滤和排序已启用的插件（与侧边栏菜单保持一致）
  const enabledPlugins = useMemo(() => {
    // 过滤：已启用 + 有页面 + 显示在菜单中
    const filtered = plugins.filter(
      p => p.state === PluginState.PluginStateEnabled
        && p.hasPage !== false
        && p.showInMenu !== false
    )

    // 分离固定插件和普通插件
    const pinnedPlugins = filtered.filter(p => p.pinned === true)
    const normalPlugins = filtered.filter(p => p.pinned !== true)

    // 固定插件排序：按 PinnedAt 降序（最新固定的在前）→ Score 降序 → 名称升序
    const sortPinnedPlugins = (a: PluginMetadata, b: PluginMetadata) => {
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

    // 普通插件排序：按 Score 降序 → 名称升序
    const sortNormalPlugins = (a: PluginMetadata, b: PluginMetadata) => {
      const scoreDiff = (b.score || 0) - (a.score || 0)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    // 合并：固定插件在前，普通插件在后
    return [
      ...pinnedPlugins.sort(sortPinnedPlugins),
      ...normalPlugins.sort(sortNormalPlugins),
    ]
  }, [plugins])

  // 加载系统状态
  const loadSystemStatus = useCallback(async () => {
    try {
      const info = await SysInfoService.GetSystemInfo()
      if (info) {
        setSystemStatus({
          cpu: info.cpuUsage || 0,
          memory: info.memoryUsedPercent || 0,
          uptime: info.hostUptime || '-'
        })
      }
    } catch (_err) {
      console.error('Failed to load system status:', _err)
    }
  }, [])

  // 初始化加载系统状态
  useEffect(() => {
    loadSystemStatus()

    // 监听系统信息更新
    const unsub = Events.On('sysinfo:updated', () => {
      loadSystemStatus()
    })

    return () => {
      unsub?.()
    }
  }, [loadSystemStatus])

  // 点击插件卡片 - 导航到插件页面
  const handlePluginClick = (pluginId: string) => {
    navigate(`/plugins/${pluginId}`)
  }

  // 浏览插件按钮 - 导航到插件市场
  const handleBrowsePlugins = () => {
    navigate('/plugins')
  }

  // 加载状态
  if (pluginsLoading) {
    return <LoadingSkeleton />
  }

  // 空状态 - 没有启用的插件
  if (enabledPlugins.length === 0) {
    return <EmptyState onBrowse={handleBrowsePlugins} />
  }

  // 主界面：综合仪表盘
  return (
    <div className="p-6 min-h-full animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white/90 mb-1">仪表盘</h1>
          <p className="text-sm text-white/40">快速访问您的工具</p>
        </div>

        {/* 主布局网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：快速启动面板 */}
          <div className="lg:col-span-2">
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-white/80 flex items-center gap-2">
                  <Icon name="sparkles" size={16} color="#A78BFA" />
                  快速启动
                </h2>
                <span className="text-xs text-white/30">
                  {enabledPlugins.length} 个插件
                </span>
              </div>

              {/* 插件网格 */}
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {enabledPlugins.map(plugin => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    onClick={handlePluginClick}
                  />
                ))}
              </div>

              {/* 底部分隔线和链接 */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={handleBrowsePlugins}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
                >
                  管理插件
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4">
            {/* 最近使用 */}
            <RecentPlugins
              plugins={enabledPlugins}
              onPluginClick={handlePluginClick}
            />

            {/* 系统状态 */}
            <SystemStatusCard status={systemStatus} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

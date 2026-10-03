import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { usePlugins } from '../plugins/usePlugins'
import { getPluginIconName } from '../utils/pluginHelpers'
import { PluginMetadata, PluginState } from '../../bindings/ltools/internal/plugins'
import { SysInfoService } from '../../bindings/ltools/plugins/sysinfo'
import { Events } from '@wailsio/runtime'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Skeleton,
} from '../components/ui'

// ==================== 类型定义 ====================

interface SystemStatus {
  cpu: number
  memory: number
  uptime: string
}

// ==================== 子组件 ====================

/**
 * 加载骨架屏 — 结构与真实布局一致
 */
function LoadingSkeleton() {
  return (
    <div className="page animate-fade-in" aria-busy="true">
      <div className="mb-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-3 w-44" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左侧:插件网格骨架 */}
        <div className="lg:col-span-2 min-w-0">
          <Skeleton className="mb-2.5 h-3 w-16" />
          <div className="grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-[9px]" />
            ))}
          </div>
        </div>

        {/* 右侧:最近使用 / 系统状态骨架 */}
        <aside className="min-w-0 space-y-5">
          <div>
            <Skeleton className="mb-2.5 h-3 w-16" />
            <Skeleton className="h-44 rounded-[9px]" />
          </div>
          <div>
            <Skeleton className="mb-2.5 h-3 w-16" />
            <Skeleton className="h-52 rounded-[9px]" />
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * 插件卡片 — 点击打开插件页
 */
function PluginCard({
  plugin,
  onClick,
}: {
  plugin: PluginMetadata
  onClick: (pluginId: string) => void
}) {
  return (
    <button
      onClick={() => onClick(plugin.id)}
      className="card card-hover flex flex-col items-center gap-2.5 px-3 py-4 text-center"
      title={plugin.description || plugin.name}
    >
      <Icon name={getPluginIconName(plugin)} size={26} className="text-text-2" />
      <span className="w-full truncate text-[12.5px] font-medium text-text-1">
        {plugin.name}
      </span>
    </button>
  )
}

/**
 * 最近使用 / 常用工具列表
 */
function RecentPlugins({
  plugins,
  onPluginClick,
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

  const renderRow = (plugin: PluginMetadata, time?: string) => (
    <button
      key={plugin.id}
      onClick={() => onPluginClick(plugin.id)}
      className="row row-clickable w-full text-left px-2.5"
    >
      <Icon name={getPluginIconName(plugin)} size={16} className="shrink-0 text-text-3" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-1">{plugin.name}</span>
      {time && (
        <span className="tnum shrink-0 text-[11.5px] text-text-3">{time}</span>
      )}
    </button>
  )

  return (
    <section>
      <SectionTitle title="最近使用" className="mb-2.5" />
      <Card inset className="p-1.5">
        {recentPlugins.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {recentPlugins.map(plugin =>
              renderRow(plugin, formatRelativeTime(plugin.lastUsedAt!))
            )}
          </div>
        ) : frequentPlugins.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-text-3">
              常用工具
            </div>
            {frequentPlugins.map(plugin => renderRow(plugin))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <Icon name="clock" size={18} className="text-text-4" />
            <p className="text-[12px] text-text-3">暂无使用记录</p>
          </div>
        )}
      </Card>
    </section>
  )
}

/**
 * 单项系统指标:标签 + 数值 + 进度条
 */
function StatusMetric({
  icon,
  label,
  value,
}: {
  icon: IconName
  label: string
  value: number
}) {
  const tone = value > 80 ? 'error' : value > 60 ? 'warning' : 'accent'
  const valueClass =
    value > 80 ? 'text-error-text' : value > 60 ? 'text-warning-text' : 'text-text-1'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-text-2">
          <Icon name={icon} size={13} className="text-text-3" />
          {label}
        </span>
        <span className={`tnum text-[12.5px] font-semibold ${valueClass}`}>
          {value.toFixed(0)}%
        </span>
      </div>
      <ProgressBar value={value} tone={tone} />
    </div>
  )
}

/**
 * 系统状态卡片 — CPU / 内存 / 运行时间
 */
function SystemStatusCard({
  status,
  error,
}: {
  status: SystemStatus | null
  error: boolean
}) {
  return (
    <section>
      <SectionTitle title="系统状态" className="mb-2.5" />
      <Card inset className="p-4">
        {status ? (
          <>
            <div className="space-y-3.5">
              <StatusMetric icon="cpu" label="CPU" value={status.cpu} />
              <StatusMetric icon="memory" label="内存" value={status.memory} />
            </div>
            <div className="hairline-t mt-4 flex min-w-0 items-center justify-between gap-3 pt-3">
              <span className="shrink-0 text-[12px] text-text-3">运行时间</span>
              <span className="tnum min-w-0 truncate text-[12px] text-text-2">
                {status.uptime}
              </span>
            </div>
          </>
        ) : error ? (
          <div className="flex items-center gap-2 py-1.5 text-[12px] text-text-3">
            <Icon name="exclamation-circle" size={14} className="text-text-4" />
            系统信息不可用
          </div>
        ) : (
          <div className="space-y-3.5" aria-hidden="true">
            {[0, 1].map(i => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1 w-full" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}

// ==================== 主组件 ====================

/**
 * 首页组件 - 综合仪表盘
 *
 * 布局结构:
 * ┌─────────────────────────────────┬─────────────────┐
 * │                                 │   最近使用       │
 * │      快速启动                    ├─────────────────┤
 * │      (插件网格)                  │   系统状态       │
 * │                                 │   (CPU/内存)     │
 * └─────────────────────────────────┴─────────────────┘
 */
function Home() {
  const navigate = useNavigate()
  const { plugins, loading: pluginsLoading } = usePlugins()
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

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
        setStatusError(false)
      } else {
        setStatusError(true)
      }
    } catch (_err) {
      console.error('Failed to load system status:', _err)
      setStatusError(true)
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
    return (
      <div className="page">
        <PageHeader title="仪表盘" description="快速访问您的工具" />
        <EmptyState
          icon="puzzle-piece"
          title="暂无启用的插件"
          description="启用插件后，它们将显示在这里以便快速访问"
          className="min-h-[calc(100vh-200px)]"
          action={
            <Button variant="primary" icon="grid" onClick={handleBrowsePlugins}>
              浏览插件
            </Button>
          }
        />
      </div>
    )
  }

  // 主界面：综合仪表盘
  return (
    <div className="page animate-fade-in">
      <PageHeader
        title="仪表盘"
        description="快速访问您的工具"
        actions={
          <span className="tnum text-[12px] text-text-3">
            {enabledPlugins.length} 个插件
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左侧：快速启动插件网格 */}
        <section className="lg:col-span-2 min-w-0">
          <SectionTitle
            title="快速启动"
            className="mb-2.5"
            action={
              <Button variant="ghost" size="sm" icon="arrow-right" onClick={handleBrowsePlugins}>
                管理插件
              </Button>
            }
          />
          <div className="grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {enabledPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onClick={handlePluginClick}
              />
            ))}
          </div>
        </section>

        {/* 右侧边栏 */}
        <aside className="min-w-0 space-y-5">
          {/* 最近使用 */}
          <RecentPlugins
            plugins={enabledPlugins}
            onPluginClick={handlePluginClick}
          />

          {/* 系统状态 */}
          <SystemStatusCard status={systemStatus} error={statusError} />
        </aside>
      </div>
    </div>
  )
}

export default Home

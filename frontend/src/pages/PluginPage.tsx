import { useParams, useNavigate } from 'react-router-dom'
import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { usePlugins } from '../plugins/usePlugins'
import { getPluginIconName } from '../utils/pluginHelpers'
import { PluginMetadata, PluginType } from '../../bindings/ltools/internal/plugins'
import { Badge, Button, Card, EmptyState, IconButton, Skeleton } from '../components/ui'

// 导入所有插件组件
import { DateTimeWidget, TimestampConverter } from '../components/DateTimeWidget'
import { ClipboardWidget } from '../components/ClipboardWidget'
import { SystemInfoWidget } from '../components/SystemInfoWidget'
import { CalculatorWidget } from '../components/CalculatorWidget'
import { JSONEditorWidget } from '../components/JSONEditorWidget'
import { ProcessManagerWidget } from '../components/ProcessManagerWidget'
import { PasswordGeneratorWidget } from '../components/PasswordGeneratorWidget'
import { QrcodeWidget } from '../components/QrcodeWidget'
import { HostsWidget } from '../components/HostsWidget'
import { TunnelWidget } from '../components/TunnelWidget'
import Screenshot2Widget from '../components/Screenshot2Widget'
import { KanbanWidget } from '../components/kanban'
import { MarkdownWidget } from '../components/MarkdownWidget'
import { VaultWidget } from '../components/vault'
import { BookmarkPage } from '../pages/BookmarkPage'
import IPInfoWidget from '../components/IPInfoWidget'
import { StickyWidget } from '../components/StickyWidget'
import { ImageBedWidget } from '../components/ImageBedWidget'
import { ImageProcessorWidget } from '../components/ImageProcessorWidget'
import { LocalTranslateWidget } from '../components/LocalTranslateWidget'

// ==================== 通用子组件 ====================

const PLUGIN_TYPE_LABELS: Record<PluginType, string> = {
  [PluginType.$zero]: '未知',
  [PluginType.PluginTypeBuiltIn]: '内置',
  [PluginType.PluginTypeWeb]: 'Web',
  [PluginType.PluginTypeNative]: '原生',
}

/**
 * 插件页头：返回操作 + 图标 + 标题（19px）+ 描述 + 次级元信息（12px）
 */
function PluginHeader({
  icon,
  title,
  description,
  meta,
  onBack,
}: {
  icon: IconName
  title: string
  description?: string
  meta?: string
  onBack?: () => void
}) {
  return (
    <div className="mb-5">
      {onBack && (
        <div className="mb-3">
          <IconButton name="arrow-left" label="返回" onClick={onBack} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="card-inset flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon name={icon} size={20} className="text-text-2" />
        </div>
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {description && (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text-2">{description}</p>
          )}
        </div>
      </div>
      {meta && <p className="tnum mt-2 text-[12px] text-text-3">{meta}</p>}
    </div>
  )
}

/**
 * 标准插件布局：页容器 + 插件页头 + 内容
 */
function StandardPluginLayout({
  plugin,
  onBack,
  width = 'max-w-4xl',
  children,
}: {
  plugin: PluginMetadata
  onBack: () => void
  width?: string
  children: ReactNode
}) {
  return (
    <div className="page-wide animate-fade-in">
      <div className={`mx-auto min-w-0 ${width}`}>
        <PluginHeader
          icon={getPluginIconName(plugin)}
          title={plugin.name}
          description={plugin.description}
          meta={`v${plugin.version} · by ${plugin.author}`}
          onBack={onBack}
        />
        {children}
      </div>
    </div>
  )
}

/**
 * 元信息行：label 左对齐灰，值右对齐
 */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hairline-b flex items-center justify-between gap-6 px-4 py-2.5 [&:last-child]:border-b-0">
      <span className="shrink-0 text-[12px] text-text-3">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[12.5px] text-text-2">
        {children}
      </div>
    </div>
  )
}

/**
 * 插件元信息卡：版本 / 作者 / 类型 / 许可 / 主页 / 权限 / 关键词
 */
function PluginMetaCard({ plugin }: { plugin: PluginMetadata }) {
  const permissions = plugin.permissions ?? []
  const keywords = plugin.keywords ?? []

  return (
    <Card>
      <MetaRow label="版本">
        <span className="tnum">v{plugin.version}</span>
      </MetaRow>
      <MetaRow label="作者">{plugin.author}</MetaRow>
      <MetaRow label="类型">{PLUGIN_TYPE_LABELS[plugin.type] ?? '未知'}</MetaRow>
      {plugin.license && <MetaRow label="许可证">{plugin.license}</MetaRow>}
      {plugin.homepage && (
        <MetaRow label="主页">
          <a
            href={plugin.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1"
          >
            <span className="truncate">{plugin.homepage}</span>
            <Icon name="external-link" size={12} className="shrink-0" />
          </a>
        </MetaRow>
      )}
      {permissions.length > 0 && (
        <MetaRow label="所需权限">
          {permissions.map((permission, i) => (
            <Badge key={`${permission}-${i}`} tone="neutral">
              {permission}
            </Badge>
          ))}
        </MetaRow>
      )}
      {keywords.length > 0 && (
        <MetaRow label="关键词">
          {keywords.map((keyword, i) => (
            <Badge key={`${keyword}-${i}`} tone="neutral">
              {keyword}
            </Badge>
          ))}
        </MetaRow>
      )}
    </Card>
  )
}

/**
 * 音乐播放器启动器 — 打开独立播放器窗口
 */
function MusicPlayerLauncher() {
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)

  const openPlayer = async () => {
    if (opening) return
    setOpening(true)
    setFailed(false)
    try {
      // 使用 LX Music 服务（新版本）
      const MusicPlayerService = await import('../../bindings/ltools/plugins/musicplayer/servicelx')
      await MusicPlayerService.ShowWindow()
    } catch (error) {
      console.error('Failed to open music player:', error)
      setFailed(true)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col items-center py-2 text-center">
      <Button variant="primary" size="lg" icon="play" loading={opening} onClick={openPlayer}>
        打开播放器
      </Button>
      <p className="mt-2 text-[12px] text-text-3">
        {failed ? '打开播放器失败，请重试' : '点击打开独立的音乐播放器窗口'}
      </p>
    </div>
  )
}

/**
 * 插件页面组件
 * 支持状态缓存（KeepAlive）
 */
function PluginPage() {
  const { pluginId } = useParams<{ pluginId: string }>()
  const navigate = useNavigate()
  const { plugins, loading } = usePlugins()

  const plugin = useMemo(() => {
    return plugins.find(p => p.id === pluginId)
  }, [plugins, pluginId])

  const handleBack = () => {
    navigate('/')
  }

  // 加载中显示骨架屏
  if (loading) {
    return (
      <div className="page" aria-busy="true">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-72 rounded-[9px]" />
      </div>
    )
  }

  if (!plugin) {
    return (
      <div className="page">
        <EmptyState
          icon="exclamation-circle"
          title="插件未找到"
          description={`插件 "${pluginId}" 不存在或未启用`}
          className="min-h-[calc(100vh-200px)]"
          action={
            <Button icon="arrow-left" onClick={handleBack}>
              返回首页
            </Button>
          }
        />
      </div>
    )
  }

  // 处理 hasPage: false 的插件
  if (plugin.hasPage === false) {
    return (
      <div className="page animate-fade-in">
        <PluginHeader
          icon={getPluginIconName(plugin)}
          title={plugin.name}
          description={plugin.description}
          meta={`v${plugin.version} · by ${plugin.author}`}
          onBack={handleBack}
        />
        <Card inset className="p-5">
          <p className="text-[12.5px] text-text-2">
            此插件通过快捷键或其他方式调用，无需独立页面。
          </p>
          {plugin.keywords && plugin.keywords.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[12px] text-text-3">关键词</p>
              <div className="flex flex-wrap gap-1.5">
                {plugin.keywords.map((kw: string, i: number) => (
                  <Badge key={`${kw}-${i}`} tone="neutral">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // 渲染插件内容
  return (
    <PluginContent
      pluginId={pluginId!}
      plugin={plugin}
      onBack={handleBack}
      isActive={true}
    />
  )
}

/**
 * 插件内容组件
 * 根据 pluginId 渲染对应的插件界面
 */
interface PluginContentProps {
  pluginId: string
  plugin: PluginMetadata
  onBack: () => void
  isActive: boolean
}

function PluginContent({ pluginId, plugin, onBack, isActive }: PluginContentProps) {
  // 使用 CSS hidden 保持组件状态（KeepAlive）
  const visibilityClass = isActive ? '' : 'hidden'

  // 根据插件 ID 渲染对应的组件
  const renderPluginWidget = () => {
    switch (pluginId) {
      case 'clipboard.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack}>
            <ClipboardWidget />
          </StandardPluginLayout>
        )

      case 'sysinfo.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack}>
            <SystemInfoWidget />
          </StandardPluginLayout>
        )

      case 'calculator.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <CalculatorWidget />
          </StandardPluginLayout>
        )

      case 'jsoneditor.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <JSONEditorWidget />
          </StandardPluginLayout>
        )

      case 'processmanager.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <ProcessManagerWidget />
          </StandardPluginLayout>
        )

      case 'qrcode.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack}>
            <QrcodeWidget />
          </StandardPluginLayout>
        )

      case 'hosts.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <HostsWidget />
          </StandardPluginLayout>
        )

      case 'datetime.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-2xl">
            <div className="space-y-8">
              <DateTimeWidget />
              <TimestampConverter />
            </div>
          </StandardPluginLayout>
        )

      case 'screenshot2.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-2xl">
            <Screenshot2Widget />
          </StandardPluginLayout>
        )

      case 'password.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <PasswordGeneratorWidget />
          </StandardPluginLayout>
        )

      case 'tunnel.builtin':
        return (
          <div className="p-6">
            <TunnelWidget onBack={onBack} />
          </div>
        )

      case 'kanban.builtin':
        return (
          <div className="absolute inset-0 overflow-hidden">
            <KanbanWidget />
          </div>
        )

      case 'markdown.builtin':
        return (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <MarkdownWidget />
          </div>
        )

      case 'vault.builtin':
        return (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <VaultWidget />
          </div>
        )

      case 'bookmark.builtin':
        return (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <BookmarkPage />
          </div>
        )

      case 'ipinfo.builtin':
        return (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <IPInfoWidget />
          </div>
        )

      case 'sticky.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <StickyWidget />
          </StandardPluginLayout>
        )

      case 'imagebed.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-6xl">
            <ImageBedWidget />
          </StandardPluginLayout>
        )

      case 'imageprocessor.builtin':
        return (
          <div className="h-full">
            <ImageProcessorWidget />
          </div>
        )

      case 'localtranslate.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack}>
            <LocalTranslateWidget />
          </StandardPluginLayout>
        )

      case 'musicplayer.builtin':
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack} width="max-w-2xl">
            <Card className="p-6">
              <MusicPlayerLauncher />
            </Card>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="p-4">
                <h3 className="mb-2 text-[12px] font-semibold text-text-3">功能特性</h3>
                <ul className="list-disc space-y-1 pl-4 text-[12px] text-text-2">
                  <li>多平台音乐源支持</li>
                  <li>随机播放模式</li>
                  <li>自动播放下一曲</li>
                  <li>预加载队列优化</li>
                </ul>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 text-[12px] font-semibold text-text-3">支持平台</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="neutral">网易云音乐</Badge>
                  <Badge tone="neutral">腾讯音乐</Badge>
                  <Badge tone="neutral">酷狗音乐</Badge>
                </div>
              </Card>
            </div>
          </StandardPluginLayout>
        )

      default:
        // 默认插件界面
        return (
          <StandardPluginLayout plugin={plugin} onBack={onBack}>
            {/* 插件内容区域 */}
            <Card className="p-6">
              <EmptyState
                icon="cube"
                title="插件功能正在开发中"
                description={`此插件 (${plugin.id}) 已成功启用，但尚未实现用户界面。`}
              />
            </Card>

            {/* 插件信息 */}
            <div className="mt-3">
              <PluginMetaCard plugin={plugin} />
            </div>
          </StandardPluginLayout>
        )
    }
  }

  return (
    <div className={visibilityClass}>
      {renderPluginWidget()}
    </div>
  )
}

export default PluginPage

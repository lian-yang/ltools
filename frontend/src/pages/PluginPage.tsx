import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { Icon } from '../components/Icon'
import { usePlugins } from '../plugins/usePlugins'
import { getPluginIcon } from '../utils/pluginHelpers'

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
import { LocalTranslateWidget } from '../components/LocalTranslateWidget'

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
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 mb-6" />
              <div className="h-8 bg-white/10 rounded w-48 mx-auto mb-2" />
              <div className="h-4 bg-white/10 rounded w-64 mx-auto" />
            </div>
            <div className="glass-light rounded-xl p-8">
              <div className="h-32 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!plugin) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EF4444]/10 mb-4">
          <Icon name="exclamation-circle" size={32} color="#EF4444" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">插件未找到</h2>
        <p className="text-white/60">插件 "{pluginId}" 不存在或未启用</p>
      </div>
    )
  }

  // 处理 hasPage: false 的插件
  if (plugin.hasPage === false) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
            <Icon name="cube" size={36} color="white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{plugin.name}</h1>
          <p className="text-white/50 mb-4">{plugin.description}</p>
          <div className="glass-light rounded-xl p-6">
            <p className="text-white/60">
              此插件通过快捷键或其他方式调用，无需独立页面。
            </p>
            {plugin.keywords && plugin.keywords.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-white/40 mb-2">关键词：</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {plugin.keywords.map((kw: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const pluginIcon = getPluginIcon(plugin)

  // 渲染插件内容
  return (
    <PluginContent
      pluginId={pluginId!}
      plugin={plugin}
      pluginIcon={pluginIcon}
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
  plugin: any
  pluginIcon: string
  onBack: () => void
  isActive: boolean
}

function PluginContent({ pluginId, plugin, pluginIcon, onBack, isActive }: PluginContentProps) {
  // 使用 CSS hidden 保持组件状态（KeepAlive）
  const visibilityClass = isActive ? '' : 'hidden'

  // 根据插件 ID 渲染对应的组件
  const renderPluginWidget = () => {
    switch (pluginId) {
      case 'clipboard.builtin':
        return (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                    <Icon name="clipboard" size={28} color="white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold mb-1">剪贴板管理器</h1>
                    <p className="text-white/50">管理系统剪贴板历史记录</p>
                    <p className="text-sm text-white/30 mt-1">v1.0.0 · by LTools</p>
                  </div>
                </div>
              </div>
              <ClipboardWidget />
            </div>
          </div>
        )

      case 'sysinfo.builtin':
        return (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="information-circle" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">系统信息</h1>
                <p className="text-white/50">查看系统硬件和运行信息</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <SystemInfoWidget />
            </div>
          </div>
        )

      case 'calculator.builtin':
        return (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="calculator" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">计算器</h1>
                <p className="text-white/50">支持基本运算和科学计算</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <CalculatorWidget />
            </div>
          </div>
        )

      case 'jsoneditor.builtin':
        return (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="code" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">JSON 编辑器</h1>
                <p className="text-white/50">格式化、验证和编辑 JSON 数据</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <JSONEditorWidget />
            </div>
          </div>
        )

      case 'processmanager.builtin':
        return (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="process" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">进程管理器</h1>
                <p className="text-white/50">查看和管理系统运行中的进程</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <ProcessManagerWidget />
            </div>
          </div>
        )

      case 'qrcode.builtin':
        return (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="qrcode" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">二维码生成器</h1>
                <p className="text-white/50">快速生成二维码，支持一键复制到剪贴板</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <QrcodeWidget />
            </div>
          </div>
        )

      case 'hosts.builtin':
        return (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="server" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Hosts 管理器</h1>
                <p className="text-white/50">场景化 hosts 文件切换工具</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <HostsWidget />
            </div>
          </div>
        )

      case 'datetime.builtin':
        return (
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-4">
                  <Icon name="clock" size={28} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">日期时间插件</h1>
                <p className="text-white/50">实时显示当前时间和日期</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <div className="space-y-8">
                <DateTimeWidget />
                <TimestampConverter />
              </div>
            </div>
          </div>
        )

      case 'screenshot2.builtin':
        return (
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-4">
                  <Icon name="camera" size={28} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">截图工具</h1>
                <p className="text-white/50">微信风格的屏幕截图和标注工具</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <div className="space-y-8">
                <Screenshot2Widget />
              </div>
            </div>
          </div>
        )

      case 'password.builtin':
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="key" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">随机密码生成器</h1>
                <p className="text-white/50">生成安全的随机密码，支持自定义选项</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <PasswordGeneratorWidget />
            </div>
          </div>
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
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="document" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">便利贴</h1>
                <p className="text-white/50">创建和管理多个便利贴窗口</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <StickyWidget />
            </div>
          </div>
        )

      case 'imagebed.builtin':
        return (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="photo" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">图床</h1>
                <p className="text-white/50">使用 GitHub + jsDelivr 搭建个人图床</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools</p>
              </div>
              <ImageBedWidget />
            </div>
          </div>
        )

      case 'localtranslate.builtin':
        return (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <Icon name="language" size={36} color="white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">AI翻译</h1>
                <p className="text-white/50">支持 Ollama、OpenAI、Anthropic、DeepSeek 等，提供本地和云端翻译服务</p>
                <p className="text-sm text-white/30 mt-2">v1.0.0 · by LTools Team</p>
              </div>
              <LocalTranslateWidget />
            </div>
          </div>
        )

      case 'musicplayer.builtin':
        return (
          <div className="p-8">
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                <Icon name="play" size={36} color="white" />
              </div>
              <h1 className="text-3xl font-bold mb-2">随机音乐播放器</h1>
              <p className="text-white/50 mb-8">基于 Meting API 的随机音乐播放器，支持网易云、腾讯、酷狗等多个平台</p>

              <div className="glass-light rounded-xl p-8 mb-6">
                <button
                  onClick={async () => {
                    try {
                      const MusicPlayerService = await import('../../bindings/ltools/plugins/musicplayer/service')
                      await MusicPlayerService.ShowWindow()
                    } catch (error) {
                      console.error('Failed to open music player:', error)
                    }
                  }}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold text-lg hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="play" size={24} color="white" />
                    <span>打开播放器</span>
                  </div>
                </button>
                <p className="text-white/40 text-sm mt-4">
                  点击打开独立的音乐播放器窗口
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-light rounded-xl p-4 text-left">
                  <h3 className="text-sm font-medium text-white/60 mb-2">功能特性</h3>
                  <ul className="text-sm text-white/40 space-y-1">
                    <li>• 多平台音乐源支持</li>
                    <li>• 随机播放模式</li>
                    <li>• 自动播放下一曲</li>
                    <li>• 预加载队列优化</li>
                  </ul>
                </div>
                <div className="glass-light rounded-xl p-4 text-left">
                  <h3 className="text-sm font-medium text-white/60 mb-2">支持平台</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20">
                      网易云音乐
                    </span>
                    <span className="px-2 py-1 rounded bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20">
                      腾讯音乐
                    </span>
                    <span className="px-2 py-1 rounded bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20">
                      酷狗音乐
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        // 默认插件界面
        return (
          <div className="p-8">
            <div className="max-w-4xl mx-auto">
              {/* 插件页头 */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] mb-6">
                  <span className="text-4xl">{pluginIcon}</span>
                </div>
                <h1 className="text-3xl font-bold mb-2">{plugin.name}</h1>
                <p className="text-white/50">{plugin.description}</p>
                <p className="text-sm text-white/30 mt-2">
                  v{plugin.version} · by {plugin.author}
                </p>
              </div>

              {/* 插件内容区域 */}
              <div className="glass-light rounded-xl p-8">
                <div className="text-center py-12">
                  <Icon name="cube" size={48} color="rgba(167, 139, 250, 0.3)" />
                  <p className="text-white/40 mt-4">插件功能正在开发中...</p>
                  <p className="text-white/30 text-sm mt-2">
                    此插件 ({plugin.id}) 已成功启用，但尚未实现用户界面。
                  </p>
                </div>
              </div>

              {/* 插件信息 */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {plugin.permissions && plugin.permissions.length > 0 && (
                  <div className="glass-light rounded-xl p-4">
                    <h3 className="text-sm font-medium text-white/60 mb-2">所需权限</h3>
                    <div className="flex flex-wrap gap-2">
                      {plugin.permissions.map((perm: string, i: number) => (
                        <span key={i} className="px-2 py-1 rounded bg-[#F59E0B]/10 text-[#F59E0B] text-xs border border-[#F59E0B]/20">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {plugin.keywords && plugin.keywords.length > 0 && (
                  <div className="glass-light rounded-xl p-4">
                    <h3 className="text-sm font-medium text-white/60 mb-2">关键词</h3>
                    <div className="flex flex-wrap gap-2">
                      {plugin.keywords.map((kw: string, i: number) => (
                        <span key={i} className="px-2 py-1 rounded bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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

import { Icon } from './Icon';
import { usePlugins } from '../plugins/usePlugins';
import { useToast } from '../hooks/useToast';
import { PluginState } from '../../bindings/ltools/internal/plugins';
import { getPluginIcon } from '../utils/pluginHelpers';
import { t } from '@/i18n';

/**
 * 插件设置组件
 * 管理插件的启用/禁用和权限
 */
export function PluginsSettings() {
  const { plugins, enablePlugin, disablePlugin } = usePlugins();
  const { success, error } = useToast();

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enablePlugin(pluginId);
      } else {
        await disablePlugin(pluginId);
      }
      success(enabled ? t('插件已启用') : t('插件已禁用'));
    } catch (err: any) {
      error(t('操作失败: {msg}', { msg: err.message || err }));
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Icon name="puzzle-piece" size={20} color="#A78BFA" />
          {t('插件管理')}
        </h2>
        <p className="text-white/50 text-sm mt-1">
          {t('管理已安装的插件，启用或禁用功能模块')}
        </p>
      </div>

      {/* 插件列表 */}
      <div className="glass-light rounded-xl p-5">
        {plugins.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Icon name="puzzle-piece" size={32} color="rgba(167, 139, 250, 0.3)" className="mx-auto mb-3" />
            <p>{t('暂无已安装的插件')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <PluginItem
                key={plugin.id}
                id={plugin.id}
                name={t(plugin.name)}
                version={plugin.version}
                description={t(plugin.description)}
                icon={getPluginIcon(plugin)}
                enabled={plugin.state === PluginState.PluginStateEnabled}
                onToggle={(enabled) => handleTogglePlugin(plugin.id, enabled)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 插件项组件
 */
interface PluginItemProps {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

function PluginItem({ id, name, version, description, icon, enabled, onToggle }: PluginItemProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#0D0F1A]/50 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200">
      {/* 插件信息 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED]/20 to-[#A78BFA]/20 flex items-center justify-center text-lg flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium truncate">{name}</h3>
            <span className="text-xs text-white/30 font-mono">v{version}</span>
          </div>
          <p className="text-sm text-white/40 truncate mt-0.5">{description || t('暂无描述')}</p>
        </div>
      </div>

      {/* 开关 */}
      <label className="relative inline-flex items-center cursor-pointer ml-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
      </label>
    </div>
  );
}

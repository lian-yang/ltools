import { usePlugins } from '../plugins/usePlugins';
import { useToast } from '../hooks/useToast';
import { PluginState } from '../../bindings/ltools/internal/plugins';
import { getPluginIconName } from '../utils/pluginHelpers';
import { Icon } from './Icon';
import { EmptyState, PageHeader, Toggle } from './ui';

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
      success(enabled ? '插件已启用' : '插件已禁用');
    } catch (err: any) {
      error(`操作失败: ${err.message || err}`);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="插件"
        description="管理已安装的插件，启用或禁用功能模块"
      />

      <div className="card-inset px-4">
        {plugins.length === 0 ? (
          <EmptyState
            icon="puzzle-piece"
            title="暂无已安装的插件"
            description="安装插件后，它们会显示在这里"
          />
        ) : (
          plugins.map((plugin, index) => (
            <PluginItem
              key={plugin.id}
              id={plugin.id}
              name={plugin.name}
              version={plugin.version}
              description={plugin.description}
              icon={getPluginIconName(plugin)}
              enabled={plugin.state === PluginState.PluginStateEnabled}
              separated={index < plugins.length - 1}
              onToggle={(enabled) => handleTogglePlugin(plugin.id, enabled)}
            />
          ))
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
  icon: ReturnType<typeof getPluginIconName>;
  enabled: boolean;
  separated?: boolean;
  onToggle: (enabled: boolean) => void;
}

function PluginItem({ id, name, version, description, icon, enabled, separated, onToggle }: PluginItemProps) {
  return (
    <div
      id={`plugin-${id}`}
      className={`flex items-center justify-between gap-4 py-3 ${separated ? 'hairline-b' : ''}`}
    >
      {/* 插件信息 */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-hairline bg-surface-2">
          <Icon name={icon} size={16} className="text-text-2" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[12.5px] font-medium text-text-1">{name}</h3>
            <span className="tnum shrink-0 font-mono text-[11px] text-text-4">v{version}</span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-text-3">{description || '暂无描述'}</p>
        </div>
      </div>

      {/* 开关 */}
      <Toggle
        checked={enabled}
        onChange={onToggle}
        label={`${enabled ? '禁用' : '启用'}插件 ${name}`}
      />
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';
import { Icon } from './Icon';
import { SettingsNav, SettingsCategory } from './SettingsNav';
import { GeneralSettings } from './GeneralSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { SyncSettings } from './SyncSettings';
import { PluginsSettings } from './PluginsSettings';
import { AboutSettings } from './AboutSettings';
import { t } from '@/i18n';

interface SettingsProps {
  shortcuts: Record<string, string>;
  onSetShortcut: (pluginId: string, keyCombo: string) => Promise<void>;
  onRemoveShortcut: (keyCombo: string) => Promise<void>;
}

/**
 * 设置页面组件
 * 左侧导航 + 右侧内容区域的二级菜单布局
 */
export function Settings({ shortcuts, onSetShortcut, onRemoveShortcut }: SettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 参数读取当前标签页
  const activeCategory: SettingsCategory = (() => {
    const tab = searchParams.get('tab') as SettingsCategory;
    return tab && ['general', 'shortcuts', 'sync', 'plugins', 'about'].includes(tab) ? tab : 'general';
  })();

  // 当标签页改变时,更新 URL 参数
  const handleCategoryChange = (category: SettingsCategory) => {
    setSearchParams({ tab: category });
  };

  /**
   * 渲染当前选中的设置内容
   */
  const renderContent = () => {
    switch (activeCategory) {
      case 'general':
        return <GeneralSettings />;
      case 'shortcuts':
        return (
          <ShortcutsSettings
            shortcuts={shortcuts}
            onSetShortcut={onSetShortcut}
            onRemoveShortcut={onRemoveShortcut}
          />
        );
      case 'sync':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Icon name="cloud-arrow-up" size={20} color="#A78BFA" />
                {t('同步设置')}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {t('配置数据同步和备份选项')}
              </p>
            </div>
            <div className="glass-light rounded-xl p-5">
              <SyncSettings />
            </div>
          </div>
        );
      case 'plugins':
        return <PluginsSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex gap-6 p-6">
      {/* 左侧导航 */}
      <SettingsNav
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* 右侧内容区域 */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

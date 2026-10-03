import { useSearchParams } from 'react-router-dom';
import { SettingsNav, SettingsCategory } from './SettingsNav';
import { GeneralSettings } from './GeneralSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { SyncSettings } from './SyncSettings';
import { PluginsSettings } from './PluginsSettings';
import { AboutSettings } from './AboutSettings';

interface SettingsProps {
  shortcuts: Record<string, string>;
  onSetShortcut: (pluginId: string, keyCombo: string) => Promise<void>;
  onRemoveShortcut: (keyCombo: string) => Promise<void>;
}

/**
 * 设置页面组件
 * 左侧分类导航 + 右侧表单内容
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
        return <SyncSettings />;
      case 'plugins':
        return <PluginsSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-full flex gap-6 p-6">
      {/* 左侧分类导航 */}
      <SettingsNav
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* 右侧内容区域(滚动由 <main> 承担,避免双滚动条) */}
      <div className="min-w-0 flex-1">
        {renderContent()}
      </div>
    </div>
  );
}

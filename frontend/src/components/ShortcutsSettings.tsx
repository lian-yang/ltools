import { useState } from 'react';
import { usePlugins } from '../plugins/usePlugins';
import { useToast } from '../hooks/useToast';
import { PluginState } from '../../bindings/ltools/internal/plugins';
import { getPluginIconName } from '../utils/pluginHelpers';
import { ShortcutEditor } from './ShortcutEditor';
import { Icon, type IconName } from './Icon';
import { Button, EmptyState, IconButton, KeyCap, PageHeader } from './ui';

/**
 * 快捷键信息接口
 */
interface ShortcutInfo {
  pluginId: string;
  keyCombo: string;
  displayText: string;
}

/**
 * 插件快捷键项
 */
interface PluginShortcutItem {
  pluginId: string;
  pluginName: string;
  pluginIcon: IconName;
  shortcut?: ShortcutInfo;
}

interface ShortcutsSettingsProps {
  shortcuts: Record<string, string>;
  onSetShortcut: (pluginId: string, keyCombo: string) => Promise<void>;
  onRemoveShortcut: (keyCombo: string) => Promise<void>;
}

/**
 * 快捷键设置组件
 */
export function ShortcutsSettings({ shortcuts, onSetShortcut, onRemoveShortcut }: ShortcutsSettingsProps) {
  const { plugins } = usePlugins();
  const { success, error } = useToast();
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);

  // 获取已启用的插件
  const enabledPlugins = plugins.filter(p => p.state === PluginState.PluginStateEnabled);

  // 构建 pluginId -> keyCombo 的映射
  const pluginToShortcut: Record<string, string> = {};
  Object.entries(shortcuts).forEach(([keyCombo, pluginId]) => {
    pluginToShortcut[pluginId] = keyCombo;
  });

  // 为每个已启用的插件创建快捷键项
  const pluginShortcuts: PluginShortcutItem[] = enabledPlugins.map(plugin => {
    const keyCombo = pluginToShortcut[plugin.id];
    return {
      pluginId: plugin.id,
      pluginName: plugin.name,
      pluginIcon: getPluginIconName(plugin),
      shortcut: keyCombo ? {
        pluginId: plugin.id,
        keyCombo: keyCombo,
        displayText: formatShortcutDisplay(keyCombo),
      } : undefined,
    };
  });
  const searchKey = pluginToShortcut['search.window.builtin'];
  const searchItem: PluginShortcutItem = {
    pluginId: 'search.window.builtin', pluginName: '全局搜索', pluginIcon: 'search',
    shortcut: searchKey ? { pluginId: 'search.window.builtin', keyCombo: searchKey,
      displayText: formatShortcutDisplay(searchKey) } : undefined,
  };
  const defaultSearchKey = navigator.platform.toLowerCase().includes('mac') ? 'cmd+5' : 'ctrl+5';
  const allItems = [searchItem, ...pluginShortcuts];

  const handleSetShortcut = async (pluginId: string, keyCombo: string) => {
    try {
      await onSetShortcut(pluginId, keyCombo);
      success(`快捷键已设置: ${keyCombo}`);
      setEditingPlugin(null);
    } catch (err: any) {
      error(`设置失败: ${err.message || err}`);
      throw err;
    }
  };

  const handleRemoveShortcut = async (keyCombo: string) => {
    try {
      await onRemoveShortcut(keyCombo);
      success(`快捷键已移除`);
    } catch (err: any) {
      error(`移除失败: ${err.message || err}`);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="快捷键"
      />

      <div className="card-inset mb-4 px-4">
        <ShortcutItem item={searchItem} onEdit={() => setEditingPlugin(searchItem.pluginId)}
          onReset={() => void handleSetShortcut(searchItem.pluginId, defaultSearchKey).catch(() => {})} />
      </div>

      <div className="card-inset px-4">
        {pluginShortcuts.length === 0 ? (
          <EmptyState
            icon="keyboard"
            title="暂无已启用的插件"
            description="启用插件后，可在此为它们分配全局快捷键"
          />
        ) : (
          pluginShortcuts.map((item, index) => (
            <ShortcutItem
              key={item.pluginId}
              item={item}
              separated={index < pluginShortcuts.length - 1}
              onEdit={() => setEditingPlugin(item.pluginId)}
              onRemove={item.shortcut ? () => handleRemoveShortcut(item.shortcut!.keyCombo) : undefined}
            />
          ))
        )}
      </div>

      {/* 快捷键编辑器 */}
      {editingPlugin && (
        <ShortcutEditor
          pluginId={editingPlugin}
          pluginName={allItems.find(p => p.pluginId === editingPlugin)?.pluginName || ''}
          currentShortcut={allItems.find(p => p.pluginId === editingPlugin)?.shortcut}
          existingShortcuts={shortcuts}
          onSave={(keyCombo) => handleSetShortcut(editingPlugin, keyCombo)}
          onCancel={() => setEditingPlugin(null)}
        />
      )}
    </div>
  );
}

/**
 * 单个快捷键项
 */
interface ShortcutItemProps {
  item: PluginShortcutItem;
  separated?: boolean;
  onEdit: () => void;
  onRemove?: () => void;
  onReset?: () => void;
}

function ShortcutItem({ item, separated, onEdit, onRemove, onReset }: ShortcutItemProps) {
  const keyParts = item.shortcut?.displayText.split('+').filter(Boolean) ?? [];

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${separated ? 'hairline-b' : ''}`}
    >
      {/* 插件信息 */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-hairline bg-surface-2">
          <Icon name={item.pluginIcon} size={16} className="text-text-2" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[12.5px] font-medium text-text-1">{item.pluginName}</h3>
          <p className="mt-0.5 text-[11.5px] text-text-3">
            {item.shortcut ? '全局快捷键' : '未设置快捷键'}
          </p>
        </div>
      </div>

      {/* 快捷键与操作 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {item.shortcut ? (
          <>
            <span className="mr-1 flex items-center gap-1">
              {keyParts.map((part, i) => (
                <KeyCap key={`${part}-${i}`}>{part}</KeyCap>
              ))}
            </span>
            <IconButton name="pencil" label="编辑快捷键" size="sm" onClick={onEdit} />
            {onRemove && <IconButton name="x-circle" label="移除快捷键" size="sm" tone="danger" onClick={onRemove} />}
          </>
        ) : (
          <Button variant="secondary" size="sm" icon="plus" onClick={onEdit}>
            设置快捷键
          </Button>
        )}
        {onReset && <IconButton name="refresh" label="恢复默认快捷键" size="sm" onClick={onReset} />}
      </div>
    </div>
  );
}

/**
 * 格式化快捷键用于显示
 */
function formatShortcutDisplay(keyCombo: string): string {
  const platform = navigator.platform.toLowerCase();
  const isMac = platform.includes('mac');

  const parts = keyCombo.split('+');
  const modifiers: string[] = [];
  let mainKey = '';

  parts.forEach(part => {
    switch (part) {
      case 'ctrl':
        modifiers.push(isMac ? '⌘' : 'Ctrl');
        break;
      case 'cmd':
        modifiers.push(isMac ? '⌘' : 'Win');
        break;
      case 'shift':
        modifiers.push(isMac ? '⇧' : 'Shift');
        break;
      case 'alt':
        modifiers.push(isMac ? '⌥' : 'Alt');
        break;
      default:
        mainKey = part.toUpperCase();
    }
  });

  return [...modifiers, mainKey].filter(Boolean).join('+');
}

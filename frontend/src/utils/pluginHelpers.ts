import { PluginMetadata } from '../../bindings/ltools/internal/plugins';
import type { IconName } from '../components/Icon';

/**
 * 插件 ID → 图标映射(仅 SVG 图标,无 emoji fallback)
 */
export const PLUGIN_ICON_MAP: Record<string, IconName> = {
  // 内置插件
  'datetime.builtin': 'clock',
  'calculator.builtin': 'calculator',
  'clipboard.builtin': 'clipboard',
  'jsoneditor.builtin': 'code-bracket',
  'processmanager.builtin': 'process',
  'screenshot.builtin': 'camera',
  'screenshot2.builtin': 'camera',
  'sysinfo.builtin': 'server',
  'applauncher.builtin': 'grid',
  'bookmark.builtin': 'bookmark',
  'qrcode.builtin': 'qrcode',
  'hosts.builtin': 'network',
  'tunnel.builtin': 'network',
  'kanban.builtin': 'view-columns',
  'markdown.builtin': 'document',
  'imagebed.builtin': 'photo',
  'sticky.builtin': 'pin',
  'musicplayer.builtin': 'heart',
  'vault.builtin': 'shield-check',
  'ipinfo.builtin': 'globe',
  'localtranslate.builtin': 'language',
  'password.builtin': 'key',
};

/** 未收录插件的默认图标 */
export const DEFAULT_PLUGIN_ICON: IconName = 'puzzle-piece';

/**
 * 获取插件图标名。
 * 优先查内置映射,其次信任插件自身声明的图标名(必须是合法 IconName 格式),否则返回默认图标。
 */
export function getPluginIconName(plugin: PluginMetadata): IconName {
  const mapped = PLUGIN_ICON_MAP[plugin.id];
  if (mapped) return mapped;

  const declared = (plugin.icon || '').trim();
  if (declared && /^[a-z0-9-]+$/.test(declared)) {
    return declared as IconName;
  }

  return DEFAULT_PLUGIN_ICON;
}

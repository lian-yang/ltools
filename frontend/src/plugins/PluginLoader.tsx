import { lazy, Suspense, ReactNode } from 'react';
import { PluginMetadata, PluginType, PluginState } from '../../bindings/ltools/internal/plugins';

import { t } from '@/i18n';
// 插件注册表
const pluginRegistry = new Map<string, () => Promise<{ default: React.ComponentType }>>();

/**
 * 注册一个插件组件
 * @param id 插件ID
 * @param loader 返回插件组件的Promise函数
 */
export function registerPlugin(
  id: string,
  loader: () => Promise<{ default: React.ComponentType }>
): void {
  pluginRegistry.set(id, loader);
}

/**
 * 动态加载插件组件
 * @param metadata 插件元数据
 * @returns React组件或null
 */
export function loadPluginComponent(metadata: PluginMetadata): React.ComponentType | null {
  // 内置插件不需要动态加载，由Wails服务处理
  if (metadata.type === PluginType.PluginTypeBuiltIn) {
    return null;
  }

  const loader = pluginRegistry.get(metadata.id);
  if (!loader) {
    console.warn(`Plugin loader not found for: ${metadata.id}`);
    return null;
  }

  // 使用React.lazy创建懒加载组件
  return lazy(loader);
}

/**
 * 插件沙箱容器组件
 * 负责加载和渲染插件组件，并提供错误边界
 */
interface PluginSandboxProps {
  metadata: PluginMetadata;
  fallback?: ReactNode;
  children?: ReactNode;
}

export function PluginSandbox({ metadata, fallback, children }: PluginSandboxProps): JSX.Element {
  const Component = loadPluginComponent(metadata);

  if (!Component) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={fallback || <div>Loading plugin...</div>}>
      <Component />
    </Suspense>
  );
}

/**
 * 插件加载状态组件
 */
interface PluginLoadingProps {
  metadata: PluginMetadata;
}

export function PluginLoading({ metadata }: PluginLoadingProps): JSX.Element {
  return (
    <div className="plugin-loading">
      <div className="plugin-loading-spinner" />
      <p>Loading {metadata.name}...</p>
    </div>
  );
}

/**
 * 插件错误状态组件
 */
interface PluginErrorProps {
  metadata: PluginMetadata;
  error?: Error;
}

export function PluginError({ metadata, error }: PluginErrorProps): JSX.Element {
  return (
    <div className="plugin-error">
      <h3>Plugin Error: {metadata.name}</h3>
      <p>{error?.message || 'Unknown error'}</p>
      <button onClick={() => window.location.reload()}>
        Reload Application
      </button>
    </div>
  );
}

/**
 * 搜索插件
 * @param plugins 插件列表
 * @param keywords 搜索关键词
 * @returns 匹配的插件列表
 */
export function searchPlugins(
  plugins: PluginMetadata[],
  keywords: string[]
): PluginMetadata[] {
  if (keywords.length === 0) {
    return plugins;
  }

  return plugins.filter((plugin) => {
    const searchText = [
      plugin.name,
      plugin.description,
      plugin.author,
      t(plugin.name),
      t(plugin.description),
      ...(plugin.keywords || []),
    ].join(' ').toLowerCase();

    return keywords.some((keyword) =>
      searchText.includes(keyword.toLowerCase())
    );
  });
}

/**
 * 按类型过滤插件
 * @param plugins 插件列表
 * @param type 插件类型
 * @returns 过滤后的插件列表
 */
export function filterPluginsByType(
  plugins: PluginMetadata[],
  type: PluginType
): PluginMetadata[] {
  return plugins.filter((plugin) => plugin.type === type);
}

/**
 * 按状态过滤插件
 * @param plugins 插件列表
 * @param state 插件状态
 * @returns 过滤后的插件列表
 */
export function filterPluginsByState(
  plugins: PluginMetadata[],
  state: PluginState
): PluginMetadata[] {
  return plugins.filter((plugin) => plugin.state === state);
}

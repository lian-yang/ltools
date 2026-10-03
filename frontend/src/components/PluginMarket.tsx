import { useState, useMemo, type KeyboardEvent } from 'react';
import { usePlugins } from '../plugins/usePlugins';
import { searchPlugins } from '../plugins/PluginLoader';
import { PluginMetadata, PluginState, PluginType } from '../../bindings/ltools/internal/plugins';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import { getPluginIconName } from '../utils/pluginHelpers';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Segmented,
  Skeleton,
  type BadgeTone,
  type SegmentedOption,
} from './ui';

/**
 * 插件状态 → 徽章（文案 + 色调）
 */
const STATE_BADGES: Partial<Record<PluginState, { label: string; tone: BadgeTone }>> = {
  [PluginState.PluginStateEnabled]: { label: '已启用', tone: 'success' },
  [PluginState.PluginStateDisabled]: { label: '已禁用', tone: 'neutral' },
  [PluginState.PluginStateError]: { label: '错误', tone: 'error' },
  [PluginState.PluginStateInstalled]: { label: '已安装', tone: 'neutral' },
};

const TYPE_LABELS: Record<PluginType, string> = {
  [PluginType.$zero]: '未知',
  [PluginType.PluginTypeBuiltIn]: '内置',
  [PluginType.PluginTypeWeb]: 'Web',
  [PluginType.PluginTypeNative]: '原生',
};

/**
 * 插件卡片组件
 */
interface PluginCardProps {
  plugin: PluginMetadata;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  isLoading?: boolean;
}

function PluginCard({ plugin, onEnable, onDisable, isLoading }: PluginCardProps): JSX.Element {
  const isEnabled = plugin.state === PluginState.PluginStateEnabled;
  const stateBadge =
    STATE_BADGES[plugin.state] ?? { label: '未知', tone: 'neutral' as BadgeTone };
  const typeLabel = TYPE_LABELS[plugin.type] ?? '未知';

  return (
    <Card hover className="flex flex-col p-4">
      {/* 头部：图标 + 名称/元信息 + 状态徽章 */}
      <div className="flex items-start gap-3">
        <div className="card-inset flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon name={getPluginIconName(plugin)} size={20} className="text-text-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-[13px] font-semibold text-text-1" title={plugin.name}>
              {plugin.name}
            </h3>
            <Badge tone={stateBadge.tone} className="shrink-0">
              {stateBadge.label}
            </Badge>
          </div>
          <p
            className="tnum mt-0.5 truncate text-[12px] text-text-3"
            title={`v${plugin.version} · by ${plugin.author}`}
          >
            v{plugin.version} · {plugin.author}
          </p>
        </div>
      </div>

      {/* 描述 */}
      <p className="mt-3 line-clamp-2 min-h-[36px] text-[12px] leading-normal text-text-2">
        {plugin.description}
      </p>

      {/* 权限 */}
      {plugin.permissions && plugin.permissions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-text-4">权限</span>
          {plugin.permissions.map((permission, i) => (
            <Badge key={`${permission}-${i}`} tone="neutral">
              {permission}
            </Badge>
          ))}
        </div>
      )}

      {/* 关键词 */}
      {plugin.keywords && plugin.keywords.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {plugin.keywords.slice(0, 3).map((keyword, i) => (
            <Badge key={`${keyword}-${i}`} tone="neutral">
              {keyword}
            </Badge>
          ))}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="hairline-t mt-3 flex items-center justify-between gap-2 pt-3">
        <Badge tone="neutral">{typeLabel}</Badge>
        <div className="flex items-center gap-1.5">
          {plugin.homepage && (
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="查看主页"
              aria-label="查看主页"
            >
              <Icon name="external-link" size={15} />
            </a>
          )}
          {isEnabled ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDisable(plugin.id)}
              disabled={isLoading}
              loading={isLoading}
            >
              禁用
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onEnable(plugin.id)}
              disabled={isLoading}
              loading={isLoading}
            >
              启用
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * 搜索栏组件
 */
interface SearchBarProps {
  onSearch: (keywords: string[]) => void;
  resultCount: number;
}

function SearchBar({ onSearch, resultCount }: SearchBarProps): JSX.Element {
  const [searchText, setSearchText] = useState('');

  const handleSearch = () => {
    const keywords = searchText
      .split(/\s+/)
      .filter((kw) => kw.trim().length > 0);
    onSearch(keywords);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchText('');
    onSearch([]);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {/* 搜索输入框（search 图标前缀 + 清除按钮） */}
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4"
          />
          <Input
            type="text"
            className="pr-9 pl-8"
            placeholder="搜索插件（支持关键词、名称、描述）"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {searchText && (
            <IconButton
              name="close"
              label="清空搜索"
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={handleClear}
            />
          )}
        </div>

        {/* 搜索按钮 */}
        <Button variant="primary" icon="search" onClick={handleSearch}>
          搜索
        </Button>
      </div>

      {/* 结果统计 */}
      {resultCount > 0 && (
        <p className="mt-2 text-[12px] text-text-3">
          找到 <span className="tnum font-medium text-text-2">{resultCount}</span> 个插件
        </p>
      )}
    </div>
  );
}

/**
 * 插件过滤器组件
 */
type TypeFilterValue = PluginType | 'all';
type StateFilterValue = PluginState | 'all';

const TYPE_OPTIONS: SegmentedOption<TypeFilterValue>[] = [
  { value: 'all', label: '全部' },
  { value: PluginType.PluginTypeBuiltIn, label: '内置' },
  { value: PluginType.PluginTypeWeb, label: 'Web' },
  { value: PluginType.PluginTypeNative, label: '原生' },
];

const STATE_OPTIONS: SegmentedOption<StateFilterValue>[] = [
  { value: 'all', label: '全部' },
  { value: PluginState.PluginStateEnabled, label: '已启用' },
  { value: PluginState.PluginStateDisabled, label: '已禁用' },
];

interface PluginFiltersProps {
  onFilterType: (type: PluginType | null) => void;
  onFilterState: (state: PluginState | null) => void;
  currentType: PluginType | null;
  currentState: PluginState | null;
}

function PluginFilters({ onFilterType, onFilterState, currentType, currentState }: PluginFiltersProps): JSX.Element {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
      {/* 类型过滤器 */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-3">类型</span>
        <Segmented<TypeFilterValue>
          options={TYPE_OPTIONS}
          value={currentType ?? 'all'}
          onChange={(value) => onFilterType(value === 'all' ? null : value)}
        />
      </div>

      {/* 状态过滤器 */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-3">状态</span>
        <Segmented<StateFilterValue>
          options={STATE_OPTIONS}
          value={currentState ?? 'all'}
          onChange={(value) => onFilterState(value === 'all' ? null : value)}
        />
      </div>
    </div>
  );
}

/**
 * 骨架屏加载组件
 */
function PluginCardSkeleton(): JSX.Element {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-2/3" />
      <div className="hairline-t mt-4 flex items-center justify-between pt-3">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-[27px] w-14" />
      </div>
    </div>
  );
}

function MarketSkeleton(): JSX.Element {
  return (
    <div aria-busy="true">
      <div className="mb-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-3 w-44" />
      </div>
      <Skeleton className="mb-4 h-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PluginCardSkeleton key={`plugin-skeleton-${i}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * 插件市场主组件
 */
export function PluginMarket(): JSX.Element {
  const { plugins, loading, error, enablePlugin: enablePluginBase, disablePlugin: disablePluginBase } = usePlugins();
  const { toasts, removeToast, success, error: showError } = useToast();
  const [searchResults, setSearchResults] = useState<PluginMetadata[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterType, setFilterType] = useState<PluginType | null>(null);
  const [filterState, setFilterState] = useState<PluginState | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 应用过滤器
  const displayedPlugins = useMemo(() => {
    let result = hasSearched ? searchResults : plugins;

    if (filterType) {
      result = result.filter((p) => p.type === filterType);
    }

    if (filterState) {
      result = result.filter((p) => p.state === filterState);
    }

    return result;
  }, [hasSearched, searchResults, plugins, filterType, filterState]);

  const handleSearch = async (keywords: string[]) => {
    if (keywords.length === 0) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }

    const results = await searchPlugins(plugins, keywords);
    setSearchResults(results);
    setHasSearched(true);
  };

  // 包装启用函数以添加 toast 通知和加载状态
  const handleEnable = async (id: string) => {
    try {
      setProcessingId(id);
      await enablePluginBase(id);
      const plugin = plugins.find((p) => p.id === id);
      success(`插件 "${plugin?.name || id}" 已启用`);
    } catch (err) {
      showError(`启用插件失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 包装禁用函数以添加 toast 通知和加载状态
  const handleDisable = async (id: string) => {
    try {
      setProcessingId(id);
      await disablePluginBase(id);
      const plugin = plugins.find((p) => p.id === id);
      success(`插件 "${plugin?.name || id}" 已禁用`);
    } catch (err) {
      showError(`禁用插件失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 加载状态
  if (loading) {
    return <MarketSkeleton />;
  }

  // 错误状态
  if (error) {
    return (
      <EmptyState
        icon="exclamation-circle"
        title="加载失败"
        description={error.message}
        className="min-h-[calc(100vh-200px)]"
        action={
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        }
      />
    );
  }

  // 正常状态
  return (
    <div>
      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* 页头 */}
      <PageHeader
        title="插件市场"
        description="浏览和管理所有可用插件"
        actions={<span className="tnum text-[12px] text-text-3">{plugins.length} 个插件</span>}
      />

      {/* 搜索栏 */}
      <SearchBar
        onSearch={handleSearch}
        resultCount={displayedPlugins.length}
      />

      {/* 过滤器 */}
      <PluginFilters
        onFilterType={setFilterType}
        onFilterState={setFilterState}
        currentType={filterType}
        currentState={filterState}
      />

      {/* 插件列表 / 空状态 */}
      {displayedPlugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayedPlugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onEnable={handleEnable}
              onDisable={handleDisable}
              isLoading={processingId === plugin.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="没有找到匹配的插件"
          description={hasSearched ? '尝试使用不同的关键词搜索' : '尝试调整过滤器条件'}
        />
      )}
    </div>
  );
}

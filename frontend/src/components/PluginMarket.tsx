import React, { useState, useMemo } from 'react';
import { usePlugins } from '../plugins/usePlugins';
import { searchPlugins } from '../plugins/PluginLoader';
import { PluginMetadata, PluginState, PluginType } from '../../bindings/ltools/internal/plugins';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import { getPluginIcon } from '../utils/pluginHelpers';
import { t } from '@/i18n';

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
  const displayIcon = getPluginIcon(plugin);

  // 获取状态样式
  const getStatusStyles = () => {
    switch (plugin.state) {
      case PluginState.PluginStateEnabled:
        return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20';
      case PluginState.PluginStateDisabled:
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
      case PluginState.PluginStateError:
        return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
      default:
        return 'bg-white/5 text-white/50 border-white/10';
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (plugin.state) {
      case PluginState.PluginStateEnabled:
        return t('已启用');
      case PluginState.PluginStateDisabled:
        return t('已禁用');
      case PluginState.PluginStateError:
        return t('错误');
      default:
        return t('未知');
    }
  };

  // 获取插件类型徽章样式
  const getTypeBadge = () => {
    switch (plugin.type) {
      case PluginType.PluginTypeBuiltIn:
        return { label: t('内置'), className: 'bg-[#7C3AED]/10 text-[#A78BFA] border-[#7C3AED]/20' };
      case PluginType.PluginTypeWeb:
        return { label: 'Web', className: 'bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/20' };
      case PluginType.PluginTypeNative:
        return { label: t('原生'), className: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' };
      default:
        return { label: t('未知'), className: 'bg-white/5 text-white/50 border-white/10' };
    }
  };

  const typeBadge = getTypeBadge();

  return (
    <div className="glass-light rounded-xl p-5 hover-lift transition-all duration-200 group">
      {/* 头部 */}
      <div className="flex items-start gap-4 mb-4">
        {/* 图标 */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7C3AED]/20 to-[#A78BFA]/20 flex items-center justify-center text-2xl flex-shrink-0" title={displayIcon}>
          {displayIcon}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">
                {t(plugin.name)}
              </h3>
              <p className="text-sm text-white/40">
                v{plugin.version} · by {plugin.author}
              </p>
            </div>

            {/* 状态徽章 */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles()} flex-shrink-0`}>
              {getStatusText()}
            </div>
          </div>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-sm text-white/60 mb-4 line-clamp-2">
        {t(plugin.description)}
      </p>

      {/* 关键词 */}
      {plugin.keywords && plugin.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {plugin.keywords.slice(0, 3).map((keyword, index) => (
            <span
              key={index}
              className="px-2.5 py-1 rounded-md bg-[#7C3AED]/10 text-[#A78BFA] text-xs border border-[#7C3AED]/20"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      {/* 权限 */}
      {plugin.permissions && plugin.permissions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-white/40">{t('权限:')}</span>
          {plugin.permissions.map((permission, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] text-xs border border-[#F59E0B]/20"
            >
              {permission}
            </span>
          ))}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        {/* 类型徽章 */}
        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${typeBadge.className}`}>
          {typeBadge.label}
        </span>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {plugin.homepage && (
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200 clickable"
              title={t("查看主页")}
            >
              <Icon name="external-link" size={16} />
            </a>
          )}

          {isEnabled ? (
            <button
              className="px-4 py-2 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 hover:bg-[#F59E0B]/20 transition-all duration-200 text-sm font-medium clickable disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onDisable(plugin.id)}
              disabled={isLoading}
            >
              {isLoading ? t('处理中...') : t('禁用')}
            </button>
          ) : (
            <button
              className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 text-sm font-medium clickable hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onEnable(plugin.id)}
              disabled={isLoading}
            >
              {isLoading ? t('处理中...') : t('启用')}
            </button>
          )}
        </div>
      </div>
    </div>
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchText('');
    onSearch([]);
  };

  return (
    <div className="glass-light rounded-xl p-4 mb-6">
      <div className="flex gap-3">
        {/* 搜索图标 */}
        <div className="flex items-center justify-center w-10 text-white/40">
          <Icon name="search" size={20} />
        </div>

        {/* 输入框 */}
        <input
          type="text"
          className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none"
          placeholder={t("搜索插件（支持关键词、名称、描述）...")}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        {/* 清除按钮 */}
        {searchText && (
          <button
            className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200 clickable"
            onClick={handleClear}
          >
            <Icon name="x-circle" size={18} />
          </button>
        )}

        {/* 搜索按钮 */}
        <button
          className="px-5 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 text-sm font-medium clickable"
          onClick={handleSearch}
        >
          {t('搜索')}
        </button>
      </div>

      {/* 结果统计 */}
      {resultCount > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-sm text-white/40">
            {t('找到')} <span className="text-[#A78BFA] font-medium">{resultCount}</span> {t('个插件')}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 插件过滤器组件
 */
interface PluginFiltersProps {
  onFilterType: (type: PluginType | null) => void;
  onFilterState: (state: PluginState | null) => void;
  currentType: PluginType | null;
  currentState: PluginState | null;
}

function PluginFilters({ onFilterType, onFilterState, currentType, currentState }: PluginFiltersProps): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-4 flex flex-wrap gap-3 mb-6">
      {/* 类型过滤器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/40">{t('类型:')}</span>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              !currentType
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterType(null)}
          >
            {t('全部')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              currentType === PluginType.PluginTypeBuiltIn
                ? 'bg-[#7C3AED]/20 text-[#A78BFA] border border-[#7C3AED]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterType(PluginType.PluginTypeBuiltIn)}
          >
            {t('内置')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              currentType === PluginType.PluginTypeWeb
                ? 'bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterType(PluginType.PluginTypeWeb)}
          >
            Web
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              currentType === PluginType.PluginTypeNative
                ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterType(PluginType.PluginTypeNative)}
          >
            {t('原生')}
          </button>
        </div>
      </div>

      {/* 状态过滤器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/40">{t('状态:')}</span>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              !currentState
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterState(null)}
          >
            {t('全部')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              currentState === PluginState.PluginStateEnabled
                ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterState(PluginState.PluginStateEnabled)}
          >
            {t('已启用')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 clickable ${
              currentState === PluginState.PluginStateDisabled
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
            onClick={() => onFilterState(PluginState.PluginStateDisabled)}
          >
            {t('已禁用')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 骨架屏加载组件
 */
function PluginCardSkeleton(): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-5">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg skeleton" />
        <div className="flex-1">
          <div className="h-5 w-3/4 skeleton mb-2" />
          <div className="h-4 w-1/2 skeleton" />
        </div>
      </div>
      <div className="h-4 w-full skeleton mb-2" />
      <div className="h-4 w-2/3 skeleton mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-16 skeleton" />
        <div className="h-6 w-20 skeleton" />
      </div>
      <div className="h-px bg-white/10" />
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
      success(t('插件 "{name}" 已启用', { name: plugin?.name || id }));
    } catch (err) {
      showError(t('启用插件失败: {msg}', { msg: err instanceof Error ? err.message : t('未知错误') }));
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
      success(t('插件 "{name}" 已禁用', { name: plugin?.name || id }));
    } catch (err) {
      showError(t('禁用插件失败: {msg}', { msg: err instanceof Error ? err.message : t('未知错误') }));
    } finally {
      setProcessingId(null);
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('插件市场')}</h1>
          <p className="text-white/40">{t('加载中...')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PluginCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EF4444]/10 mb-4">
          <Icon name="exclamation-circle" size={32} color="#EF4444" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{t('加载失败')}</h2>
        <p className="text-white/60 mb-6">{error.message}</p>
        <button
          className="px-6 py-3 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 font-medium clickable hover-lift"
          onClick={() => window.location.reload()}
        >
          {t('重新加载')}
        </button>
      </div>
    );
  }

  // 正常状态
  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">{t('插件市场')}</h1>
        <p className="text-white/40">
          {t('浏览和管理所有可用插件')}
        </p>
      </div>

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

      {/* 插件列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* 空状态 */}
      {displayedPlugins.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
            <Icon name="search" size={28} color="rgba(255,255,255,0.3)" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{t('没有找到匹配的插件')}</h3>
          <p className="text-white/40 text-sm">
            {hasSearched ? t('尝试使用不同的关键词搜索') : t('尝试调整过滤器条件')}
          </p>
        </div>
      )}
    </div>
  );
}

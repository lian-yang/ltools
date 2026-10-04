import { useState, useEffect, useRef, useCallback } from 'react';
import { useBookmarks, CacheStatus } from '../hooks/useBookmarks';
import { Icon } from '../components/Icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { t } from '@/i18n';

// 浏览器图标映射
const BROWSER_ICONS: Record<string, string> = {
  chrome: '🌐',
  safari: '🧭',
  firefox: '🦊',
};

// 浏览器名称映射
const BROWSER_NAMES: Record<string, string> = {
  chrome: 'Chrome',
  safari: 'Safari',
  firefox: 'Firefox',
};

export const BookmarkPage = () => {
  const { search, sync, getCacheStatus, openURL, exportHTML, exportJSON, searching, syncing, error } = useBookmarks();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [browserFilter, setBrowserFilter] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 加载缓存状态
  useEffect(() => {
    getCacheStatus().then(setCacheStatus);
  }, [getCacheStatus]);

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 搜索书签（debounce 200ms）
  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(async () => {
      const searchResults = await search(query);
      setResults(searchResults);
      setSelectedIndex(0);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, search]);

  // 过滤结果 - 查询为空时直接返回空数组
  const filteredResults = !query.trim() ? [] : (
    browserFilter === 'all' ? results : results.filter(r => r.bookmark.browser === browserFilter)
  );

  // 键盘导航
  useEffect(() => {
    if (!query.trim() || filteredResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredResults[selectedIndex];
        if (selected) openURL(selected.bookmark.url);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, filteredResults, selectedIndex, openURL]);

  // 同步书签
  const handleSync = useCallback(async () => {
    if (await sync()) {
      getCacheStatus().then(setCacheStatus);
    }
  }, [sync, getCacheStatus]);

  // 导出
  const handleExport = useCallback(async (type: 'html' | 'json') => {
    setShowExportMenu(false);
    if (type === 'html') await exportHTML();
    else await exportJSON();
  }, [exportHTML, exportJSON]);

  return (
    <div className="h-full flex flex-col bg-[#0D0F1A]">
      {/* 头部 */}
      <div className="p-5 border-b border-white/10">
        <div className="max-w-4xl mx-auto">
          {/* 标题 */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <Icon name="bookmark" size={22} color="white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('书签管理')}</h1>
              <p className="text-white/40 text-sm">{t('搜索和管理浏览器书签')}</p>
            </div>
          </div>

          {/* 搜索栏 */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-[3]">
              <Icon name="search" size={16} color="rgba(255,255,255,0.4)" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("搜索书签...")}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#7C3AED]/50 transition-all"
              />
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger className="h-[42px]">
                  <SelectValue placeholder={t("浏览器")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('全部')}</SelectItem>
                  <SelectItem value="chrome">Chrome</SelectItem>
                  <SelectItem value="safari">Safari</SelectItem>
                  <SelectItem value="firefox">Firefox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 操作区 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {syncing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t('同步中...')}
                  </>
                ) : (
                  <>
                    <Icon name="refresh" size={14} color="white" />
                    {t('同步')}
                  </>
                )}
              </button>

              {/* 导出按钮 */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Icon name="download" size={14} color="white" />
                  {t('导出')}
                  <Icon name="chevron-down" size={12} color="white" />
                </button>

                {showExportMenu && (
                  <div className="absolute top-full left-0 mt-2 w-44 glass-light rounded-lg border border-white/10 overflow-hidden z-10">
                    <button
                      onClick={() => handleExport('html')}
                      className="w-full px-3 py-2.5 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3 text-sm"
                    >
                      <span>📄</span>
                      <div>
                        <div className="font-medium">{t('导出 HTML')}</div>
                        <div className="text-xs text-white/40">{t('Netscape 格式')}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-3 py-2.5 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3 text-sm border-t border-white/10"
                    >
                      <span>📋</span>
                      <div>
                        <div className="font-medium">{t('导出 JSON')}</div>
                        <div className="text-xs text-white/40">{t('结构化数据')}</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 缓存状态 */}
            {cacheStatus && (
              <div className="flex items-center gap-4 text-sm text-white/50">
                <span>{t('共')} <span className="text-white font-medium">{cacheStatus.total_count}</span> {t('个书签')}</span>
                <span className="hidden sm:inline">
                  {t('同步于')} <span className="text-white/70">{cacheStatus.last_sync || t('从未')}</span>
                </span>
                {cacheStatus.is_expired && (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Icon name="exclamation-circle" size={12} color="#F59E0B" />
                    {t('需同步')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 浏览器统计 */}
          {cacheStatus?.browser_stats && Object.keys(cacheStatus.browser_stats).length > 0 && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {Object.entries(cacheStatus.browser_stats).map(([browser, count]) => (
                <div
                  key={browser}
                  className="px-3 py-1.5 glass-light rounded-lg border border-white/5 flex items-center gap-2 text-sm"
                >
                  <span>{BROWSER_ICONS[browser] || '🔖'}</span>
                  <span className="text-white/50">{BROWSER_NAMES[browser] || browser}</span>
                  <span className="text-white font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-5 mt-3 max-w-4xl lg:mx-auto">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2 text-sm">
            <Icon name="exclamation-circle" size={16} color="#EF4444" />
            {error}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {searching ? (
            <div className="text-center text-white/40 py-12">
              <span className="animate-spin inline-block text-xl mb-2">⏳</span>
              <p className="text-sm">{t('搜索中...')}</p>
            </div>
          ) : query && filteredResults.length === 0 ? (
            <div className="text-center text-white/40 py-12">
              <Icon name="search" size={32} color="rgba(255,255,255,0.2)" className="mb-3" />
              <p className="text-sm">{t('未找到匹配的书签')}</p>
            </div>
          ) : !query ? (
            <div className="text-center text-white/40 py-12">
              <Icon name="bookmark" size={32} color="rgba(255,255,255,0.2)" className="mb-3" />
              <p className="text-sm">{t('输入关键词搜索书签')}</p>
              <p className="text-xs text-white/30 mt-1">{t('支持标题、URL 和拼音')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResults.map((result, index) => (
                <div
                  key={`${result.bookmark.browser}-${result.bookmark.id}-${index}`}
                  onClick={() => openURL(result.bookmark.url)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    index === selectedIndex
                      ? 'bg-[#7C3AED]/20 border border-[#7C3AED]/30'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">
                      {BROWSER_ICONS[result.bookmark.browser] || '🔖'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate text-sm">{result.bookmark.title}</div>
                      <div className="text-white/40 text-xs truncate">{result.bookmark.url}</div>
                    </div>
                    {result.bookmark.folder && (
                      <span className="text-xs text-white/30 flex items-center gap-1 flex-shrink-0">
                        <Icon name="folder" size={10} color="rgba(255,255,255,0.3)" />
                        {result.bookmark.folder}
                      </span>
                    )}
                    <Icon name="arrow-right" size={14} color="rgba(255,255,255,0.2)" className="flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

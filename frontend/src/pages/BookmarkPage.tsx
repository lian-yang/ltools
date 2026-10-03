import { useState, useEffect, useRef, useCallback } from 'react';
import { useBookmarks, CacheStatus } from '../hooks/useBookmarks';
import { Icon } from '../components/Icon';
import { Badge, Button, EmptyState, Input, Spinner } from '../components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="hairline-b px-6 pb-4 pt-5">
        <div className="mx-auto max-w-4xl">
          {/* 标题 */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-hairline bg-surface-2">
              <Icon name="bookmark" size={17} color="var(--color-accent-text)" />
            </div>
            <div>
              <h1 className="page-title">书签管理</h1>
              <p className="page-subtitle">搜索和管理浏览器书签</p>
            </div>
          </div>

          {/* 搜索栏 */}
          <div className="mb-3 flex gap-2.5">
            <div className="relative flex-[3]">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4" />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索书签…"
                className="h-9 pl-8"
              />
            </div>
            <div className="min-w-[130px] max-w-[160px] flex-1">
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="浏览器" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="chrome">Chrome</SelectItem>
                  <SelectItem value="safari">Safari</SelectItem>
                  <SelectItem value="firefox">Firefox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 操作区 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="primary" icon="refresh" onClick={handleSync} loading={syncing}>
                同步
              </Button>

              {/* 导出按钮 */}
              <div className="relative" ref={exportMenuRef}>
                <Button variant="secondary" icon="download" onClick={() => setShowExportMenu(!showExportMenu)}>
                  导出
                  <Icon name="chevron-down" size={11} />
                </Button>

                {showExportMenu && (
                  <div className="menu absolute left-0 top-full z-10 mt-1.5 w-44">
                    <button onClick={() => handleExport('html')} className="menu-item">
                      <Icon name="document" size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">导出 HTML</span>
                        <span className="block text-[10.5px] text-text-4">Netscape 格式</span>
                      </span>
                    </button>
                    <button onClick={() => handleExport('json')} className="menu-item">
                      <Icon name="code-bracket" size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">导出 JSON</span>
                        <span className="block text-[10.5px] text-text-4">结构化数据</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 缓存状态 */}
            {cacheStatus && (
              <div className="tnum flex items-center gap-3.5 text-[11.5px] text-text-3">
                <span>共 <span className="font-medium text-text-1">{cacheStatus.total_count}</span> 个书签</span>
                <span className="hidden sm:inline">
                  同步于 <span className="text-text-2">{cacheStatus.last_sync || '从未'}</span>
                </span>
                {cacheStatus.is_expired && (
                  <Badge tone="warning">需同步</Badge>
                )}
              </div>
            )}
          </div>

          {/* 浏览器统计 */}
          {cacheStatus?.browser_stats && Object.keys(cacheStatus.browser_stats).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(cacheStatus.browser_stats).map(([browser, count]) => (
                <div
                  key={browser}
                  className="card-inset tnum flex items-center gap-2 px-3 py-1.5 text-[12px]"
                >
                  <span className="text-text-3">{BROWSER_NAMES[browser] || browser}</span>
                  <span className="font-medium text-text-1">{count as number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-3 max-w-4xl lg:mx-auto">
          <div
            className="flex items-center gap-2 rounded-[7px] px-3.5 py-2.5 text-[12px]"
            style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', color: 'var(--color-error-text)' }}
          >
            <Icon name="exclamation-circle" size={14} />
            {error}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {searching ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[12.5px] text-text-3">
              <Spinner size={15} />
              搜索中…
            </div>
          ) : query && filteredResults.length === 0 ? (
            <EmptyState icon="search" title="未找到匹配的书签" description="尝试其他关键词" />
          ) : !query ? (
            <EmptyState icon="bookmark" title="输入关键词搜索书签" description="支持标题、URL 和拼音" />
          ) : (
            <div className="space-y-1.5">
              {filteredResults.map((result, index) => (
                <div
                  key={`${result.bookmark.browser}-${result.bookmark.id}-${index}`}
                  onClick={() => openURL(result.bookmark.url)}
                  className={`card group flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 ${
                    index === selectedIndex ? 'row-selected' : 'card-hover'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-surface-2">
                    <Icon name="globe" size={14} color="var(--color-text-2)" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-text-1">{result.bookmark.title}</div>
                    <div className="truncate text-[11px] text-text-3 select-text">{result.bookmark.url}</div>
                  </div>
                  {result.bookmark.folder && (
                    <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-text-4">
                      <Icon name="folder" size={10} />
                      {result.bookmark.folder}
                    </span>
                  )}
                  <Icon name="arrow-right" size={13} className="shrink-0 text-text-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

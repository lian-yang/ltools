import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icon';
import { Events } from '@wailsio/runtime';
import * as SearchWindowService from '../../bindings/ltools/internal/plugins/searchwindowservice';
import * as AppLauncherService from '../../bindings/ltools/plugins/applauncher/applauncherservice';
import { usePlugins } from '../plugins/usePlugins';
import { PluginState } from '../../bindings/ltools/internal/plugins';
import './SearchWindow.css';

interface SearchResult {
  pluginId?: string;
  appId?: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  path?: string;
}

function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, match =>
    String.fromCharCode(parseInt(match.slice(2), 16)));
}

function highlightMatch(text: string, query: string): JSX.Element {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return <>{text}</>;
  const lower = text.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let offset = 0;
  let match = lower.indexOf(needle);
  while (match !== -1) {
    parts.push(text.slice(offset, match));
    parts.push(<mark key={match}>{text.slice(match, match + needle.length)}</mark>);
    offset = match + needle.length;
    match = lower.indexOf(needle, offset);
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}

function ResultIcon({ icon }: { icon: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [icon]);
  if (!failed && /^data:image\/(?:png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon);base64,/i.test(icon)) {
    return <img src={icon} alt="" draggable={false} onError={() => setFailed(true)} />;
  }
  return <span className="search-app-icon-fallback" aria-hidden="true"><Icon name="grid" size={25} /></span>;
}

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return <div className="search-section-header"><h2>{title}{count !== undefined && <span className="search-section-count">{count}</span>}</h2>{action}</div>;
}

export function SearchWindow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAllPlugins, setShowAllPlugins] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [indexedFiles, setIndexedFiles] = useState<SearchResult[]>([]);
  const [fileIndexing, setFileIndexing] = useState(false);
  const [fileLimited, setFileLimited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const { plugins, loading: pluginsLoading, error: pluginsError } = usePlugins();
  const searchQuery = query.trim();

  const enabledPlugins = useMemo(() => plugins.filter(p =>
    p.state === PluginState.PluginStateEnabled), [plugins]);
  const recentPlugins = useMemo(() => enabledPlugins.filter(p => p.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt || 0).getTime() - new Date(a.lastUsedAt || 0).getTime())
    .slice(0, 8), [enabledPlugins]);
  const displayedPlugins = showAllPlugins ? enabledPlugins : recentPlugins;
  const appResults = useMemo(() => results.filter(r => r.type === 'app'), [results]);
  const otherResults = useMemo(() => results.filter(r => r.type !== 'app' && r.type !== 'file'), [results]);
  const fileResults = useMemo(() => {
    const seen = new Set<string>();
    return [...results.filter(r => r.type === 'file'), ...indexedFiles].filter(result => {
      const key = result.path || result.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [results, indexedFiles]);
  const displayedFiles = useMemo(() => showAllFiles ? fileResults : fileResults.slice(0, 5), [fileResults, showAllFiles]);
  const orderedResults = useMemo(() => searchQuery
    ? [...appResults, ...otherResults, ...displayedFiles]
    : displayedPlugins.map(p => ({ pluginId: p.id, name: p.name, description: p.description,
      icon: '', type: 'plugin' })), [searchQuery, appResults, otherResults, displayedPlugins, displayedFiles]);

  const updateQuery = (value: string) => {
    requestRef.current++;
    setQuery(value);
    setResults([]);
    setIndexedFiles([]);
    setShowAllFiles(false);
    setFileIndexing(false);
    setFileLimited(false);
    setSelectedIndex(0);
    setError('');
    setLoading(Boolean(value.trim()));
  };

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    const offOpened = Events.On('search:opened', (event: { data: string }) => {
      updateQuery(event.data || '');
      setShowAllPlugins(false);
      focus();
    });
    const offClosed = Events.On('search:closed', () => updateQuery(''));
    focus();
    return () => { offOpened(); offClosed(); };
  }, []);

  useEffect(() => {
    const request = ++requestRef.current;
    if (!searchQuery) { setLoading(false); return; }
    const timer = setTimeout(async () => {
      const responses = await Promise.allSettled([
        SearchWindowService.Search(searchQuery), AppLauncherService.Search(searchQuery),
        SearchWindowService.SearchFiles(searchQuery),
      ]);
      if (request !== requestRef.current) return;
      const combined: SearchResult[] = [];
      if (responses[0].status === 'fulfilled') {
        for (const item of responses[0].value ?? []) {
          if (!item) continue;
          combined.push({ ...item, name: decodeUnicode(item.name || ''),
            description: decodeUnicode(item.description || '') });
        }
      }
      if (responses[1].status === 'fulfilled') {
        for (const item of responses[1].value ?? []) {
          if (!item) continue;
          combined.push({ appId: item.id, name: decodeUnicode(item.name || ''),
            description: decodeUnicode(item.description || ''), icon: item.iconData || '', type: 'app' });
        }
      }
      if (responses[2].status === 'fulfilled') {
        const response = responses[2].value;
        setIndexedFiles((response.results || []).filter((item): item is NonNullable<typeof item> => !!item));
        setFileIndexing(response.indexing);
        setFileLimited(response.limited);
      }
      const seen = new Set<string>();
      setResults(combined.filter(item => {
        const key = `${item.type}:${item.appId || item.pluginId || item.path || item.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
      setError(responses.some(response => response.status === 'rejected')
        ? '部分搜索服务暂不可用，请重试' : '');
      setLoading(false);
    }, 150);
    return () => { clearTimeout(timer); requestRef.current++; };
  }, [query]);

  useEffect(() => {
    if (!fileIndexing || !searchQuery) return;
    const request = requestRef.current;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const response = await SearchWindowService.SearchFiles(searchQuery);
        if (!active || request !== requestRef.current) return;
        setIndexedFiles((response.results || []).filter((item): item is NonNullable<typeof item> => !!item));
        setFileIndexing(response.indexing);
        setFileLimited(response.limited);
      } catch { if (active) setFileIndexing(false); }
    }, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [fileIndexing, searchQuery]);

  const openItem = async (result: SearchResult) => {
    try {
      if (result.type === 'app' && result.appId) await SearchWindowService.OpenApp(result.appId);
      else if (result.type === 'plugin' && result.pluginId) await SearchWindowService.OpenPlugin(result.pluginId);
      else if (result.type === 'file' && result.path) await SearchWindowService.OpenPath(result.path);
    } catch {
      setError('打开失败，请重试');
    }
  };

  useEffect(() => { setSelectedIndex(0); }, [showAllPlugins, orderedResults.length]);
  useEffect(() => {
    resultsRef.current?.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (query) updateQuery('');
      else SearchWindowService.Hide().catch(() => setError('关闭窗口失败'));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!loading && orderedResults[selectedIndex]) void openItem(orderedResults[selectedIndex]);
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || loading || !orderedResults.length) return;
    // Left/right remain caret controls for text rows. App tiles navigate spatially.
    const onApps = Boolean(searchQuery) && selectedIndex < appResults.length;
    if (!onApps && ['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    let step = 1;
    if (onApps && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      const grid = resultsRef.current?.querySelector<HTMLElement>('.search-app-grid');
      const first = grid?.firstElementChild as HTMLElement | null;
      step = grid && first ? Math.max(1, Math.floor((grid.clientWidth + 8) / (first.offsetWidth + 8))) : 1;
    }
    const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
    setSelectedIndex(index => Math.max(0, Math.min(orderedResults.length - 1, index + step * direction)));
  };

  const renderRow = (result: SearchResult, index: number) => (
    <button key={result.pluginId || result.path || result.name} type="button"
      id={`search-result-${index}`} role="option" aria-selected={selectedIndex === index}
      className={`search-text-row ${selectedIndex === index ? 'is-selected' : ''}`}
      data-result-index={index} title={result.description || result.path}
      onMouseEnter={() => setSelectedIndex(index)} onClick={() => void openItem(result)}>
      <span className="search-row-name">{highlightMatch(result.name, searchQuery)}</span>
      <span className="search-row-description">{result.description || result.path}</span>
      <span className="search-row-arrow" aria-hidden="true"><Icon name="arrow-right" size={16} /></span>
    </button>
  );

  return (
    <div className="search-window">
      <header className="search-window-header" data-wails-draggable>
        <input ref={inputRef} className="search-input" type="text" autoComplete="off" spellCheck={false}
          placeholder="搜索应用、功能或文件" aria-label="全局搜索"
          role="combobox" aria-autocomplete="list" aria-expanded={orderedResults.length > 0}
          aria-controls="search-result-list" aria-activedescendant={!loading && orderedResults[selectedIndex]
            ? `search-result-${selectedIndex}` : undefined}
          data-wails-drag-draggable="false" value={query}
          onChange={event => updateQuery(event.target.value)} onKeyDown={handleKeyDown} />
        {query && <button className="search-clear" type="button" title="清空搜索" aria-label="清空搜索"
          data-wails-drag-draggable="false" onClick={() => { updateQuery(''); inputRef.current?.focus(); }}>
          <Icon name="close" size={18} />
        </button>}
        <button type="button" className="search-brand" title="打开 LTools" aria-label="打开 LTools"
          data-wails-drag-draggable="false" onClick={() => {
            void SearchWindowService.OpenMainWindow().catch(() => setError('打开主界面失败'));
          }}><img src="/app-icon.png" alt="" draggable={false} /></button>
      </header>
      <div className="search-results" ref={resultsRef} id="search-result-list" role="listbox" aria-label="搜索结果" aria-busy={loading || pluginsLoading}>
        {error && <p className="search-error" role="alert">{error}</p>}
        {loading ? <div className="search-state" role="status"><span className="spinner" />搜索中</div>
          : searchQuery ? <>
            {appResults.length > 0 && <section>
              <SectionHeader title="应用" count={appResults.length} />
              <div className="search-app-grid">
                {appResults.map((result, index) => <button key={result.appId || result.name} type="button"
                  id={`search-result-${index}`} role="option" aria-selected={selectedIndex === index}
                  className={`search-app-tile ${selectedIndex === index ? 'is-selected' : ''}`}
                  data-result-index={index} title={result.description || result.name}
                  onMouseEnter={() => setSelectedIndex(index)} onClick={() => void openItem(result)}>
                  <span className="search-app-icon"><ResultIcon icon={result.icon} /></span>
                  <span className="search-app-name">{highlightMatch(result.name, searchQuery)}</span>
                </button>)}
              </div>
            </section>}
            {otherResults.length > 0 && <section>
              <SectionHeader title="功能" count={otherResults.length} />
              <div className="search-text-list">{otherResults.map((result, index) => renderRow(result, appResults.length + index))}</div>
            </section>}
            <section className="search-file-section">
              <SectionHeader title="文件" count={fileResults.length} action={fileResults.length > 5 &&
                <button type="button" className="search-expand" aria-expanded={showAllFiles}
                  onClick={() => setShowAllFiles(value => !value)}>
                  {showAllFiles ? '收起' : `展开 (${fileResults.length}${fileLimited ? '+' : ''})`}
                </button>} />
              {displayedFiles.length > 0
                ? <div className="search-text-list">{displayedFiles.map((result, index) => renderRow(result, appResults.length + otherResults.length + index))}</div>
                : <div className="search-file-empty">{fileIndexing ? '正在索引文件' : '没有匹配的文件'}</div>}
              {fileIndexing && displayedFiles.length > 0 && <div className="search-file-empty" role="status">正在更新文件索引</div>}
            </section>
            {!results.length && !indexedFiles.length && !fileIndexing && !error && <div className="search-state">未找到匹配的结果</div>}
          </> : <section>
            <SectionHeader title={showAllPlugins ? '全部插件' : '最近使用'} action={
              <button type="button" className="search-expand" aria-expanded={showAllPlugins}
                onClick={() => setShowAllPlugins(value => !value)}>
                {showAllPlugins ? '收起' : `展开 (${enabledPlugins.length})`}
              </button>} />
            {pluginsLoading ? <div className="search-state" role="status"><span className="spinner" /></div>
              : pluginsError ? <p className="search-error" role="alert">插件加载失败，请重新打开窗口</p>
              : orderedResults.length ? <div className="search-text-list">{orderedResults.map(renderRow)}</div>
              : <div className="search-state">暂无最近使用记录</div>}
          </section>}
      </div>
      {!loading && orderedResults[selectedIndex] && <footer className="search-window-footer">
        <span className="search-footer-name">{orderedResults[selectedIndex].name}</span>
        <button type="button" className="search-open" onClick={() => void openItem(orderedResults[selectedIndex])}>
          打开<Icon name="arrow-right" size={15} />
        </button>
      </footer>}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useBookmarks, SearchResult } from '../hooks/useBookmarks';
import { Icon } from './Icon';
import { EmptyState, Spinner } from './ui';

interface BookmarkWidgetProps {
  query: string;
  onSelect?: () => void;
}

const browserIcon: Record<string, Parameters<typeof Icon>[0]['name']> = {
  chrome: 'globe',
  safari: 'globe',
  firefox: 'globe',
};

export const BookmarkWidget: React.FC<BookmarkWidgetProps> = ({ query, onSelect }) => {
  const { search, openURL } = useBookmarks();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 搜索书签
  useEffect(() => {
    const searchBookmarks = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setSearching(true);
      const searchResults = await search(query);
      setResults(searchResults);
      setSelectedIndex(0);
      setSearching(false);
    };

    const debounce = setTimeout(searchBookmarks, 200);
    return () => clearTimeout(debounce);
  }, [query, search]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          handleSelect(results[selectedIndex]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);

  // 处理选择书签
  const handleSelect = async (result: SearchResult) => {
    await openURL(result.bookmark.url);
    onSelect?.();
  };

  if (!query.trim()) {
    return (
      <EmptyState icon="bookmark" title="搜索浏览器书签" description="输入关键词搜索 Chrome、Safari、Firefox 的书签" />
    );
  }

  if (searching) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 text-[12px] text-text-3">
        <Spinner size={14} />
        搜索中…
      </div>
    );
  }

  if (results.length === 0) {
    return <EmptyState icon="search" title="未找到匹配的书签" description="尝试其他关键词" />;
  }

  return (
    <div ref={containerRef} className="max-h-96 space-y-0.5 overflow-y-auto p-1.5">
      {results.map((result, index) => (
        <div
          key={result.bookmark.id}
          className={`row row-clickable ${index === selectedIndex ? 'row-selected' : ''}`}
          onClick={() => handleSelect(result)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-surface-2">
            <Icon name={browserIcon[result.bookmark.browser] ?? 'bookmark'} size={14} color="var(--color-text-2)" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium text-text-1">
              {result.bookmark.title}
            </div>
            <div className="truncate text-[11px] text-text-3 select-text">
              {result.bookmark.url}
            </div>
            {result.bookmark.folder && (
              <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-text-4">
                <Icon name="folder" size={10} />
                <span className="truncate">{result.bookmark.folder}</span>
              </div>
            )}
          </div>
          <span className="badge badge-neutral shrink-0">{result.match_type}</span>
        </div>
      ))}
    </div>
  );
};

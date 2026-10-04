import React, { useState, useEffect, useRef } from 'react';
import { useBookmarks, SearchResult } from '../hooks/useBookmarks';
import { Icon } from './Icon';
import { t } from '@/i18n';

interface BookmarkWidgetProps {
  query: string;
  onSelect?: () => void;
}

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

  // 获取浏览器图标
  const getBrowserIcon = (browser: string) => {
    const icons: Record<string, string> = {
      chrome: '🌐',
      safari: '🧭',
      firefox: '🦊',
    };
    return icons[browser] || '🔖';
  };

  if (!query.trim()) {
    return (
      <div className="p-4 text-center text-gray-400">
        {t('输入关键词搜索浏览器书签')}
      </div>
    );
  }

  if (searching) {
    return (
      <div className="p-4 text-center text-gray-400">
        <Icon name="refresh" className="inline animate-spin mr-2" size={16} />
        {t('搜索中...')}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        {t('未找到匹配的书签')}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-h-96 overflow-y-auto">
      {results.map((result, index) => (
        <div
          key={result.bookmark.id}
          className={`px-4 py-3 cursor-pointer transition-colors ${
            index === selectedIndex
              ? 'bg-purple-500/20 border-l-2 border-purple-500'
              : 'hover:bg-white/5'
          }`}
          onClick={() => handleSelect(result)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">
              {getBrowserIcon(result.bookmark.browser)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">
                {result.bookmark.title}
              </div>
              <div className="text-gray-400 text-sm truncate">
                {result.bookmark.url}
              </div>
              {result.bookmark.folder && (
                <div className="text-gray-500 text-xs mt-1 truncate">
                  📁 {result.bookmark.folder}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 flex-shrink-0">
              {result.match_type}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

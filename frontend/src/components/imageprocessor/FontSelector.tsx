import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { FontInfo } from '../../../bindings/ltools/plugins/imageprocessor/models';
import { Icon } from '../Icon';

interface FontSelectorProps {
  fonts: FontInfo[];
  value: string;
  fontFamily?: string;
  onChange: (font: FontInfo | null) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function FontSelector({
  fonts,
  value,
  fontFamily,
  onChange,
  loading = false,
  disabled = false,
}: FontSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用 useMemo 优化过滤
  const filteredFonts = useMemo(() => {
    if (!searchQuery.trim()) return fonts; // 显示所有字体
    const query = searchQuery.toLowerCase();
    return fonts.filter((font) =>
      font.name.toLowerCase().includes(query) ||
      font.family.toLowerCase().includes(query)
    );
  }, [fonts, searchQuery]);

  // 当前选中的字体
  const selectedFont = useMemo(
    () => fonts.find((f) => f.path === value),
    [fonts, value]
  );

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 处理选择
  const handleSelect = useCallback((font: FontInfo | null) => {
    onChange(font);
    setIsOpen(false);
    setSearchQuery('');
  }, [onChange]);

  // 处理开关
  const handleToggle = useCallback(() => {
    if (!disabled && !loading) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled, loading]);

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2
          bg-white/5 hover:bg-white/10
          border border-white/10 hover:border-white/20
          rounded-lg text-left
          text-sm text-white
          focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
          flex items-center justify-between gap-2
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="type" className="w-4 h-4 text-white/50 flex-shrink-0" />
          <span className="truncate">
            {loading ? (
              <span className="text-white/50">加载字体中...</span>
            ) : selectedFont ? (
              selectedFont.name
            ) : (
              <span className="text-white/70">默认字体</span>
            )}
          </span>
        </div>
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          className="w-4 h-4 text-white/50 flex-shrink-0"
        />
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className="
            absolute z-50 top-full left-0 right-0 mt-1
            bg-[#1A1625] border border-white/10
            rounded-xl shadow-2xl shadow-black/50
            overflow-hidden
          "
        >
          {/* 搜索框 */}
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Icon
                name="magnifying-glass"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`搜索字体... (共 ${fonts.length} 个)`}
                className="
                  w-full pl-9 pr-3 py-2
                  bg-white/5 border border-white/5
                  rounded-lg text-sm text-white
                  placeholder:text-white/40
                  focus:outline-none focus:border-[#7C3AED]
                "
                autoFocus
              />
            </div>
          </div>

          {/* 字体列表 */}
          <div
            className="max-h-60 overflow-y-auto overscroll-contain"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* 默认字体选项 */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`
                w-full px-3 py-2
                flex items-center gap-3
                text-left text-sm
                transition-colors duration-100
                ${
                  !value
                    ? 'bg-[#7C3AED]/20 text-white'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                {!value && <Icon name="check" className="w-3 h-3 text-[#7C3AED]" />}
              </div>
              <span className="font-medium">默认字体</span>
              <span className="text-xs text-white/50 ml-auto">Go Regular</span>
            </button>

            {/* 字体列表 */}
            {filteredFonts.length === 0 ? (
              <div className="px-3 py-8 text-center text-white/50 text-sm">
                未找到匹配的字体
              </div>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font.path}
                  type="button"
                  onClick={() => handleSelect(font)}
                  className={`
                    w-full px-3 py-2
                    flex items-center gap-3
                    text-left text-sm
                    transition-colors duration-100
                    ${
                      value === font.path
                        ? 'bg-[#7C3AED]/20 text-white'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                    {value === font.path && (
                      <Icon name="check" className="w-3 h-3 text-[#7C3AED]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="truncate">{font.name}</span>
                    {font.isMonospace && (
                      <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/50 flex-shrink-0">
                        等宽
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}

          </div>
        </div>
      )}
    </div>
  );
}

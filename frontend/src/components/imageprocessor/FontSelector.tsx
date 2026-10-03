import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { FontInfo } from '../../../bindings/ltools/plugins/imageprocessor/models';
import { Icon } from '../Icon';
import { Input, Spinner } from '../ui';

interface FontSelectorProps {
  fonts: FontInfo[];
  value: string;
  fontFamily?: string;
  onChange: (font: FontInfo | null) => void;
  loading?: boolean;
  disabled?: boolean;
}

/* 下拉面板内容总高度上限(列表 + 搜索框) */
const DROPDOWN_MAX_H = 300;

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
  const [dropdownPos, setDropdownPos] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
    anchorTop: number;
    anchorBottom: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 使用 useMemo 优化过滤
  const filteredFonts = useMemo(() => {
    if (!searchQuery.trim()) return fonts; // 显示所有字体
    const query = searchQuery.toLowerCase();
    return fonts.filter(
      (font) =>
        font.name.toLowerCase().includes(query) || font.family.toLowerCase().includes(query)
    );
  }, [fonts, searchQuery]);

  // 当前选中的字体
  const selectedFont = useMemo(() => fonts.find((f) => f.path === value), [fonts, value]);

  // 依据触发按钮位置计算下拉面板的固定定位(避免被设置面板的 overflow 裁剪)
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_H + 8 && spaceAbove > spaceBelow;
    setDropdownPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(
        120,
        Math.min(DROPDOWN_MAX_H, (openUp ? spaceAbove : spaceBelow) - 12)
      ),
      openUp,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    });
  }, []);

  // 处理选择
  const handleSelect = useCallback(
    (font: FontInfo | null) => {
      onChange(font);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  // 处理开关
  const handleToggle = useCallback(() => {
    if (!disabled && !loading) {
      setIsOpen((prev) => {
        if (!prev) updatePosition();
        return !prev;
      });
    }
  }, [disabled, loading, updatePosition]);

  // 点击外部关闭 / 滚动缩放时关闭(保证定位不漂移)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleReposition = () => updatePosition();

    const handleScroll = (event: Event) => {
      // 下拉列表自身的滚动不关闭
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
      setSearchQuery('');
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scroll', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('scroll', handleReposition);
    };
  }, [isOpen, updatePosition]);

  const dropdownStyle: CSSProperties | undefined = dropdownPos
    ? dropdownPos.openUp
      ? {
          left: dropdownPos.left,
          width: dropdownPos.width,
          bottom: window.innerHeight - dropdownPos.anchorTop + 6,
          maxHeight: dropdownPos.maxHeight,
        }
      : {
          left: dropdownPos.left,
          width: dropdownPos.width,
          top: dropdownPos.anchorBottom + 6,
          maxHeight: dropdownPos.maxHeight,
        }
    : undefined;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon name="type" size={13} className="shrink-0 text-text-4" />
          <span className="truncate text-[12.5px]">
            {loading ? (
              <span className="flex items-center gap-1.5 text-text-3">
                <Spinner size={11} />
                加载字体中…
              </span>
            ) : selectedFont ? (
              <span className="text-text-1">{selectedFont.name}</span>
            ) : (
              <span className="text-text-3">默认字体</span>
            )}
          </span>
        </span>
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={13}
          className="shrink-0 text-text-4"
        />
      </button>

      {/* 下拉面板(portal 渲染,避免被滚动容器裁剪) */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="menu fixed z-50 flex flex-col overflow-hidden p-1 animate-slide-up"
            style={dropdownStyle}
            role="listbox"
          >
            {/* 搜索框 */}
            <div className="relative shrink-0 p-1 pb-1.5">
              <Icon
                name="search"
                size={13}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-4"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`搜索字体… (共 ${fonts.length} 个)`}
                className="pl-8"
                autoFocus
              />
            </div>

            {/* 字体列表 */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {/* 默认字体选项 */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                role="option"
                aria-selected={!value}
                className={`menu-item ${!value ? 'bg-accent-subtle text-accent-text' : ''}`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-hairline-strong bg-surface-1">
                  {!value && <Icon name="check" size={11} className="text-accent-text" />}
                </span>
                <span className="font-medium">默认字体</span>
                <span className="ml-auto text-[10.5px] text-text-4">Go Regular</span>
              </button>

              {/* 字体列表 */}
              {filteredFonts.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] text-text-3">
                  未找到匹配的字体
                </div>
              ) : (
                filteredFonts.map((font) => {
                  const active = value === font.path;
                  return (
                    <button
                      key={font.path}
                      type="button"
                      onClick={() => handleSelect(font)}
                      role="option"
                      aria-selected={active}
                      className={`menu-item ${active ? 'bg-accent-subtle text-accent-text' : ''}`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-hairline-strong bg-surface-1">
                        {active && <Icon name="check" size={11} className="text-accent-text" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{font.name}</span>
                      {font.isMonospace && (
                        <span className="shrink-0 rounded-[4px] bg-surface-4 px-1.5 py-0.5 text-[10px] text-text-3">
                          等宽
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

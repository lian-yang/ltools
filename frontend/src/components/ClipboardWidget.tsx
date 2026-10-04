import { useState, useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import { ClipboardService } from '../../bindings/ltools/plugins/clipboard';
import { ClipboardItem } from '../../bindings/ltools/plugins/clipboard/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

// Image preview modal component
interface ImagePreviewModalProps {
  imageSrc: string;
  onClose: () => void;
}

function ImagePreviewModal({ imageSrc, onClose }: ImagePreviewModalProps): JSX.Element {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img
          src={imageSrc}
          alt="Preview"
          className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white transition-colors"
          onClick={onClose}
        >
          <Icon name="x-mark" size={24} />
        </button>
      </div>
    </div>
  );
}

/**
 * 剪贴板历史项组件
 */
interface ClipboardItemProps {
  item: ClipboardItem;
  index: number;
  onCopy: (content: string) => void;
  onCopyImage: (base64Data: string) => void;
  onSaveImage: (base64Data: string) => void;
  onDelete: (index: number) => void;
  onPreviewImage: (src: string) => void;
}

function ClipboardHistoryItem({ item, index, onCopy, onCopyImage, onSaveImage, onDelete, onPreviewImage }: ClipboardItemProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { success, error: showError } = useToast();

  const handleCopy = async () => {
    if (item.type === 'image') {
      try {
        await ClipboardService.CopyImageToClipboard(item.content);
        setImageCopied(true);
        onCopyImage(item.content);
        success(t('图片已复制到剪贴板'));
        setTimeout(() => setImageCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy image:', err);
        showError(t('复制图片失败'));
      }
    } else {
      try {
        await navigator.clipboard.writeText(item.content);
        setCopied(true);
        onCopy(item.content);
        success(t('已复制到剪贴板'));
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showError(t('复制失败'));
      }
    }
  };

  const handleSaveImage = async () => {
    try {
      const timestamp = new Date().getTime();
      const defaultFilename = `clipboard_image_${timestamp}.png`;
      const filePath = await ClipboardService.SaveImageToFile(item.content, defaultFilename);
      success(t('图片已保存到: {path}', { path: filePath }));
      onSaveImage(item.content);
    } catch (err) {
      console.error('Failed to save image:', err);
      // User cancelled or error - don't show error for cancellation
      if (err instanceof Error && !err.message.includes('cancelled')) {
        showError(t('保存图片失败'));
      }
    }
  };

  const handleDelete = () => {
    onDelete(index);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('刚刚');
    if (diffMins < 60) return t('{n}分钟前', { n: diffMins });
    if (diffHours < 24) return t('{n}小时前', { n: diffHours });
    if (diffDays < 7) return t('{n}天前', { n: diffDays });

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'image':
        return 'photo';
      case 'text':
      default:
        return 'document-text';
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const renderContent = () => {
    if (item.type === 'image') {
      return (
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onPreviewImage(item.content)}
          >
            <img
              src={item.content}
              alt={t("剪贴板图片")}
              className="max-h-24 max-w-32 rounded-lg object-contain bg-white/5"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 mb-1">{t('图片')}</p>
            <p className="text-sm text-white/60 font-mono">
              {truncateContent(item.content.substring(0, 50))}...
            </p>
          </div>
        </div>
      );
    }
    return (
      <p className="text-sm text-white/90 break-words font-mono">
        {truncateContent(item.content)}
      </p>
    );
  };

  return (
    <div
      className={`glass-light rounded-lg p-4 transition-all duration-200 group ${
        isHovered ? 'bg-white/5' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
          <Icon name={getIconForType(item.type) as any} size={18} color="#A78BFA" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
            <span className="text-xs text-white/30 whitespace-nowrap">
              {formatTime(item.timestamp)}
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 clickable ${
                copied || imageCopied
                  ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/20'
                  : 'bg-[#7C3AED]/10 text-[#A78BFA] hover:bg-[#7C3AED]/20 border border-[#7C3AED]/20'
              }`}
              onClick={handleCopy}
            >
              {copied || imageCopied ? t('已复制') : (item.type === 'image' ? t('复制图片') : t('复制'))}
            </button>
            {item.type === 'image' && (
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#3B82F6]/10 text-[#60A5FA] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/20 transition-all duration-200 clickable"
                onClick={handleSaveImage}
              >
                {t('保存图片')}
              </button>
            )}
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:bg-[#EF4444]/10 hover:text-[#EF4444] border border-white/10 transition-all duration-200 clickable"
              onClick={handleDelete}
            >
              {t('删除')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 空状态组件
 */
function EmptyState(): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
        <Icon name="clipboard" size={28} color="rgba(255,255,255,0.3)" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{t('剪贴板历史为空')}</h3>
      <p className="text-white/40 text-sm">
        {t('复制的内容将自动出现在这里')}
      </p>
    </div>
  );
}

/**
 * 剪贴板管理器主组件
 */
export function ClipboardWidget(): JSX.Element {
  const { success, error: showError } = useToast();
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxHistory, setMaxHistory] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [addingClipboard, setAddingClipboard] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 加载剪贴板历史
  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyData, maxData] = await Promise.all([
        ClipboardService.GetHistory(),
        ClipboardService.GetMaxHistory()
      ]);
      setHistory(historyData);
      setFilteredHistory(historyData);
      setMaxHistory(maxData);
      setTotalCount(historyData.length);
    } catch (err) {
      console.error('Failed to load clipboard history:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化时加载历史
  useEffect(() => {
    loadHistory();
  }, []);

  // 监听剪贴板事件
  useEffect(() => {
    const unsubNew = Events.On('clipboard:new', () => {
      loadHistory();
    });

    const unsubImageNew = Events.On('clipboard:image:new', () => {
      loadHistory();
    });

    const unsubCleared = Events.On('clipboard:cleared', () => {
      setHistory([]);
      setFilteredHistory([]);
      setTotalCount(0);
    });

    const unsubCount = Events.On('clipboard:count', (ev: { data: string }) => {
      const count = parseInt(ev.data, 10);
      setTotalCount(count);
    });

    const unsubDeleted = Events.On('clipboard:deleted', () => {
      loadHistory();
    });

    const unsubImageSaved = Events.On('clipboard:image:saved', () => {
      loadHistory();
    });

    return () => {
      unsubNew?.();
      unsubImageNew?.();
      unsubCleared?.();
      unsubCount?.();
      unsubDeleted?.();
      unsubImageSaved?.();
    };
  }, []);

  // 搜索功能
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHistory(history);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = history.filter(item => {
        // For text items, search in content
        if (item.type !== 'image') {
          return item.content.toLowerCase().includes(query);
        }
        // For images, only match if searching for "image" or "图片"
        return query === 'image' || query === '图片' || query === 'img' || query === '图';
      });
      setFilteredHistory(filtered);
    }
  }, [searchQuery, history]);

  // 复制处理
  const handleCopy = (content: string) => {
    // 可以添加复制成功的提示
  };

  // 删除处理
  const handleDelete = async (index: number) => {
    try {
      await ClipboardService.DeleteItem(index);
      await loadHistory();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // 清空历史
  const handleClear = async () => {
    try {
      await ClipboardService.ClearHistory();
      setHistory([]);
      setFilteredHistory([]);
      setTotalCount(0);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // 搜索处理
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredHistory(history);
      return;
    }

    try {
      const results = await ClipboardService.SearchHistory(searchQuery);
      setFilteredHistory(results);
    } catch (err) {
      console.error('Failed to search history:', err);
    }
  };

  // 添加当前剪贴板内容
  const handleAddCurrentClipboard = async () => {
    try {
      setAddingClipboard(true);
      const currentContent = await ClipboardService.GetCurrentClipboard();
      if (currentContent) {
        await ClipboardService.AddToHistory(currentContent, 'text');
        await loadHistory();
        success(t('已添加当前剪贴板内容'));
      } else {
        showError(t('剪贴板为空或无法访问'));
      }
    } catch (err) {
      showError(t('添加失败: {msg}', { msg: err instanceof Error ? err.message : t('未知错误') }));
    } finally {
      setAddingClipboard(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-light rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 animate-pulse">
          <Icon name="refresh" size={20} color="rgba(255,255,255,0.3)" />
        </div>
        <p className="text-white/40 mt-4">{t('加载中...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          imageSrc={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t('剪贴板历史')}</h2>
          <p className="text-sm text-white/40">
            {totalCount} {t('条记录 · 最大')} {maxHistory} {t('条')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 text-sm font-medium clickable disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAddCurrentClipboard}
            disabled={addingClipboard}
          >
            {addingClipboard ? t('添加中...') : t('添加当前剪贴板')}
          </button>
          <button
            className={`px-4 py-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/20 transition-all duration-200 text-sm font-medium clickable disabled:opacity-50 disabled:cursor-not-allowed ${totalCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleClear}
            disabled={totalCount === 0}
          >
            {t('清空历史')} {totalCount === 0 ? t('(无记录)') : ''}
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="glass-light rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex items-center justify-center w-10 text-white/40">
            <Icon name="search" size={20} />
          </div>
          <input
            type="text"
            className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none"
            placeholder={t("搜索剪贴板内容...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          {searchQuery && (
            <button
              className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200 clickable"
              onClick={() => {
                setSearchQuery('');
                setFilteredHistory(history);
              }}
            >
              <Icon name="x-mark" size={18} />
            </button>
          )}
          <button
            className="px-5 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 text-sm font-medium clickable"
            onClick={handleSearch}
          >
            {t('搜索')}
          </button>
        </div>
      </div>

      {/* 历史列表 */}
      {filteredHistory.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item, index) => (
            <ClipboardHistoryItem
              key={`${item.timestamp}-${index}`}
              item={item}
              index={index}
              onCopy={handleCopy}
              onCopyImage={() => {}}
              onSaveImage={() => {}}
              onDelete={handleDelete}
              onPreviewImage={setPreviewImage}
            />
          ))}
        </div>
      )}

      {/* 统计信息 */}
      {searchQuery && filteredHistory.length > 0 && (
        <div className="text-center">
          <p className="text-sm text-white/40">
            {t('找到')} {filteredHistory.length} {t('条匹配结果')}
          </p>
        </div>
      )}
    </div>
  );
}

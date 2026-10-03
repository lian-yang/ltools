import { useState, useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import { ClipboardService } from '../../bindings/ltools/plugins/clipboard';
import { ClipboardItem } from '../../bindings/ltools/plugins/clipboard/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { Button, Card, EmptyState, IconButton, Input, Skeleton } from './ui';

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
      className="scrim fixed inset-0 z-[999] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="relative flex max-h-full max-w-[90vw] flex-col items-center">
        <IconButton
          name="x-mark"
          label="关闭预览"
          className="absolute -top-9 right-0 text-text-2"
          onClick={onClose}
        />
        <img
          src={imageSrc}
          alt="预览图片"
          className="max-h-[80vh] max-w-full rounded-[9px] border border-hairline-strong"
          style={{ boxShadow: 'var(--shadow-modal)' }}
          onClick={(e) => e.stopPropagation()}
        />
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
  const { success, error: showError } = useToast();

  const handleCopy = async () => {
    if (item.type === 'image') {
      try {
        await ClipboardService.CopyImageToClipboard(item.content);
        setImageCopied(true);
        onCopyImage(item.content);
        success('图片已复制到剪贴板');
        setTimeout(() => setImageCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy image:', err);
        showError('复制图片失败');
      }
    } else {
      try {
        await navigator.clipboard.writeText(item.content);
        setCopied(true);
        onCopy(item.content);
        success('已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showError('复制失败');
      }
    }
  };

  const handleSaveImage = async () => {
    try {
      const timestamp = new Date().getTime();
      const defaultFilename = `clipboard_image_${timestamp}.png`;
      const filePath = await ClipboardService.SaveImageToFile(item.content, defaultFilename);
      success(`图片已保存到: ${filePath}`);
      onSaveImage(item.content);
    } catch (err) {
      console.error('Failed to save image:', err);
      // User cancelled or error - don't show error for cancellation
      if (err instanceof Error && !err.message.includes('cancelled')) {
        showError('保存图片失败');
      }
    }
  };

  const handleDelete = () => {
    onDelete(index);
  };

  const formatTime = (timestamp: string | number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isImage = item.type === 'image';

  return (
    <div
      className="row row-clickable group w-full cursor-pointer"
      role="button"
      tabIndex={0}
      title={isImage ? undefined : item.content}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}
    >
      {/* 类型图标 */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-surface-2">
        <Icon name={isImage ? 'photo' : 'document'} size={15} className="text-text-3" />
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        {isImage ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="shrink-0 overflow-hidden rounded-[5px] border border-hairline"
              title="预览图片"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewImage(item.content);
              }}
            >
              <img
                src={item.content}
                alt="剪贴板图片"
                className="h-10 w-10 object-cover"
              />
            </button>
            <span className="text-[12px] text-text-3">图片</span>
          </div>
        ) : (
          <p className="truncate font-mono text-[12.5px] text-text-1">{item.content}</p>
        )}
      </div>

      {/* 时间戳 */}
      <span className="tnum shrink-0 text-[11px] text-text-4">
        {formatTime(item.timestamp)}
      </span>

      {/* 操作按钮(hover 时出现) */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          name={copied || imageCopied ? 'check' : 'copy'}
          label={copied || imageCopied ? '已复制' : isImage ? '复制图片' : '复制'}
          size="sm"
          className={copied || imageCopied ? 'text-success-text' : ''}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        />
        {isImage && (
          <IconButton
            name="eye"
            label="预览图片"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewImage(item.content);
            }}
          />
        )}
        {isImage && (
          <IconButton
            name="download"
            label="保存图片"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveImage();
            }}
          />
        )}
        <IconButton
          name="trash"
          label="删除"
          size="sm"
          tone="danger"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        />
      </div>
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
  // 修复:传入的 index 是过滤后列表的下标,搜索/过滤状态下会误删其他条目,
  // 这里映射回完整历史中的真实下标。
  const handleDelete = async (index: number) => {
    try {
      const target = filteredHistory[index];
      const realIndex = target
        ? history.findIndex(
            (h) =>
              h.content === target.content &&
              h.timestamp === target.timestamp &&
              h.type === target.type
          )
        : -1;
      const deleteIndex = realIndex >= 0 ? realIndex : index;
      await ClipboardService.DeleteItem(deleteIndex);
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
        success('已添加当前剪贴板内容');
      } else {
        showError('剪贴板为空或无法访问');
      }
    } catch (err) {
      showError(`添加失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setAddingClipboard(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 rounded-[6px]" />
        <Card inset className="p-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="m-1 h-10 rounded-[6px]" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          imageSrc={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-text-3">
          <span className="tnum font-medium text-text-2">{totalCount}</span> 条记录
          <span className="text-text-4"> · </span>上限{' '}
          <span className="tnum font-medium text-text-2">{maxHistory}</span> 条
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon="plus"
            loading={addingClipboard}
            onClick={handleAddCurrentClipboard}
          >
            添加当前剪贴板
          </Button>
          <Button
            variant="danger"
            icon="trash"
            onClick={handleClear}
            disabled={totalCount === 0}
          >
            清空历史
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-4"
          />
          <Input
            type="text"
            className="pr-9 pl-8"
            placeholder="搜索剪贴板内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          {searchQuery && (
            <IconButton
              name="close"
              label="清空搜索"
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={() => {
                setSearchQuery('');
                setFilteredHistory(history);
              }}
            />
          )}
        </div>
        <Button variant="primary" icon="search" onClick={handleSearch}>
          搜索
        </Button>
      </div>

      {/* 历史列表 */}
      {filteredHistory.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon="search"
            title="没有找到匹配的记录"
            description="尝试使用其他关键词搜索"
          />
        ) : (
          <Card inset>
            <EmptyState
              icon="clipboard"
              title="剪贴板历史为空"
              description="复制的内容将自动出现在这里"
            />
          </Card>
        )
      ) : (
        <Card inset className="p-1.5">
          <div className="flex flex-col gap-0.5">
            {filteredHistory.map((item, index) => (
              <ClipboardHistoryItem
                key={`${item.type}-${item.timestamp}-${item.content.length}`}
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
        </Card>
      )}

      {/* 统计信息 */}
      {searchQuery && filteredHistory.length > 0 && (
        <div className="text-center">
          <p className="text-[12px] text-text-3">
            找到 <span className="tnum font-medium text-text-2">{filteredHistory.length}</span>{' '}
            条匹配结果
          </p>
        </div>
      )}
    </div>
  );
}

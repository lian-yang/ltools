import React, { useState, useEffect, useCallback } from 'react';
import { Events } from '@wailsio/runtime';
import { Icon } from './Icon';
import * as StickyService from '../../bindings/ltools/plugins/sticky/stickyservice';
import { StickyNote } from '../../bindings/ltools/plugins/sticky/models';
import { Button, EmptyState, KeyCap, Modal, Spinner } from './ui';

/**
 * StickyWidget - 便利贴插件页面组件
 * 显示便利贴列表和创建按钮
 */

// 便利贴纸色(数据语义色:深色界面下降低饱和度)
const paperColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  yellow: { bg: 'rgba(255,214,10,0.08)', border: 'rgba(255,214,10,0.25)', text: '#FFE066', dot: '#FFD60A' },
  pink: { bg: 'rgba(255,55,95,0.08)', border: 'rgba(255,55,95,0.25)', text: '#FF8FA8', dot: '#FF375F' },
  green: { bg: 'rgba(48,209,88,0.08)', border: 'rgba(48,209,88,0.25)', text: '#7BE495', dot: '#30D158' },
  blue: { bg: 'rgba(100,210,255,0.08)', border: 'rgba(100,210,255,0.25)', text: '#9BDCFF', dot: '#64D2FF' },
  purple: { bg: 'rgba(191,90,242,0.09)', border: 'rgba(191,90,242,0.28)', text: '#DDB3F9', dot: '#BF5AF2' },
};

const StickyWidget: React.FC = () => {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });

  // 加载便利贴列表
  const loadNotes = useCallback(async () => {
    try {
      const data = await StickyService.ListNotes();
      setNotes(data || []);
    } catch (error) {
      console.error('[StickyWidget] Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadNotes();

    // 监听便利贴更新事件
    const unsubscribeUpdated = Events.On('sticky:updated', () => {
      loadNotes();
    });

    const unsubscribeCreated = Events.On('sticky:created', () => {
      loadNotes();
    });

    const unsubscribeDeleted = Events.On('sticky:deleted', () => {
      loadNotes();
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeCreated();
      unsubscribeDeleted();
    };
  }, [loadNotes]);

  // 创建新便利贴
  const handleCreateNote = useCallback(async () => {
    setCreating(true);
    try {
      await StickyService.CreateNote();
      // 重新加载列表
      await loadNotes();
    } catch (error) {
      console.error('[StickyWidget] Failed to create note:', error);
    } finally {
      setCreating(false);
    }
  }, [loadNotes]);

  // 打开便利贴窗口
  const handleOpenNote = useCallback(async (id: string) => {
    try {
      await StickyService.OpenNoteWindow(id);
    } catch (error) {
      console.error('[StickyWidget] Failed to open note:', error);
    }
  }, []);

  // 显示删除确认
  const showDeleteConfirm = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteConfirm({ id, show: true });
  }, []);

  // 确认删除
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm.id) return;

    try {
      await StickyService.DeleteNote(deleteConfirm.id);
      setDeleteConfirm({ id: '', show: false });
      await loadNotes();
    } catch (error) {
      console.error('[StickyWidget] Failed to delete note:', error);
    }
  }, [deleteConfirm.id, loadNotes]);

  // 取消删除
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm({ id: '', show: false });
  }, []);

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // 提取纯文本预览（去除HTML标签）
  const getPreview = (content: string) => {
    if (!content) return '';
    // 移除HTML标签
    const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    return text.slice(0, 100);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* 操作栏 */}
      <div className="mb-5 flex items-center justify-between">
        <span className="tnum text-[12px] text-text-3">共 {notes.length} 个便利贴</span>
        <Button variant="primary" icon="plus" onClick={handleCreateNote} loading={creating}>
          新建便利贴
        </Button>
      </div>

      {/* 快捷提示 */}
      <div
        className="mb-5 flex items-center gap-2 rounded-[7px] px-3.5 py-2.5 text-[12px] text-text-3"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-hairline-faint)' }}
      >
        <Icon name="information-circle" size={13} color="var(--color-text-4)" />
        <span>按</span>
        <KeyCap>Alt+T</KeyCap>
        <span>快速创建新便利贴</span>
      </div>

      {/* 便利贴网格 */}
      {notes.length === 0 ? (
        <EmptyState
          icon="document"
          title="还没有便利贴"
          description="点击上方按钮或使用快捷键创建第一个便利贴"
          action={
            <Button variant="primary" icon="plus" onClick={handleCreateNote} loading={creating}>
              创建便利贴
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map((note) => {
            const colors = paperColors[note.color] ?? paperColors.yellow;
            const preview = getPreview(note.content);

            return (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note.id)}
                className="group relative cursor-pointer rounded-[9px] border p-3.5 transition-colors duration-150"
                style={{ background: colors.bg, borderColor: colors.border }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenNote(note.id);
                }}
              >
                {/* 删除按钮 */}
                <button
                  type="button"
                  onClick={(e) => showDeleteConfirm(note.id, e)}
                  className="icon-btn icon-btn-sm absolute right-1.5 top-1.5 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  title="删除"
                >
                  <Icon name="trash" size={12} color={colors.text} />
                </button>

                {/* 内容预览 */}
                <div style={{ color: colors.text }} className="min-h-[96px]">
                  {preview ? (
                    <p className="select-text whitespace-pre-wrap text-[12.5px] leading-relaxed line-clamp-4">{preview}</p>
                  ) : (
                    <p className="text-[12.5px] italic opacity-50">空便利贴</p>
                  )}
                </div>

                {/* 底部信息 */}
                <div
                  className="tnum mt-2.5 flex items-center justify-between pt-2.5"
                  style={{ borderTop: `1px solid ${colors.border}` }}
                >
                  <span className="text-[10.5px] opacity-70">
                    {formatDate(note.updatedAt?.toString() || note.createdAt?.toString() || '')}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors.dot, opacity: 0.8 }} />
                </div>
              </div>
            );
          })}

          {/* 添加新便利贴的占位卡片 */}
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="flex min-h-[160px] flex-col items-center justify-center rounded-[9px] border border-dashed border-hairline-strong transition-colors duration-150 hover:border-text-4"
          >
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
              {creating ? (
                <Spinner size={16} />
              ) : (
                <Icon name="plus" size={16} color="var(--color-text-3)" />
              )}
            </span>
            <span className="text-[12px] text-text-3">创建新便利贴</span>
          </button>
        </div>
      )}

      {/* 删除确认对话框 */}
      <Modal
        open={deleteConfirm.show}
        onClose={handleDeleteCancel}
        title="确认删除"
        width={340}
        footer={
          <>
            <Button variant="ghost" onClick={handleDeleteCancel}>
              取消
            </Button>
            <Button variant="danger-solid" onClick={handleDeleteConfirm}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-text-2">确定要删除这个便利贴吗？此操作无法撤销。</p>
      </Modal>
    </div>
  );
};

export { StickyWidget };

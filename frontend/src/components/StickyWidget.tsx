import React, { useState, useEffect, useCallback } from 'react';
import { Events } from '@wailsio/runtime';
import { Icon } from './Icon';
import * as StickyService from '../../bindings/ltools/plugins/sticky/stickyservice';
import { StickyNote } from '../../bindings/ltools/plugins/sticky/models';
import { t } from '@/i18n';

/**
 * StickyWidget - 便利贴插件页面组件
 * 显示便利贴列表和创建按钮
 */
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

  // 获取颜色样式
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      yellow: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900' },
      pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
      green: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900' },
      blue: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-900' },
      purple: { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-900' },
    };
    return colorMap[color] || colorMap.yellow;
  };

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C3AED]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Icon name="document" size={16} />
            <span>{t('共')} {notes.length} {t('个便利贴')}</span>
          </div>
        </div>
        <button
          onClick={handleCreateNote}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {creating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Icon name="plus" size={18} />
          )}
          <span>{t('新建便利贴')}</span>
        </button>
      </div>

      {/* 快捷提示 */}
      <div className="mb-6 p-3 rounded-lg bg-[#7C3AED]/10 border border-[#7C3AED]/20">
        <p className="text-sm text-white/70 flex items-center gap-2">
          <Icon name="sparkles" size={16} color="#A78BFA" />
          <span>{t('快捷键提示：按')}</span>
          <kbd className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">Alt+T</kbd>
          <span>{t('快速创建新便利贴')}</span>
        </p>
      </div>

      {/* 便利贴网格 */}
      {notes.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-4">
            <Icon name="document" size={40} color="rgba(255,255,255,0.2)" />
          </div>
          <h3 className="text-lg font-medium text-white/80 mb-2">{t('还没有便利贴')}</h3>
          <p className="text-white/50 mb-6">{t('点击上方按钮或使用快捷键创建第一个便利贴')}</p>
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Icon name="plus" size={20} />
            <span>{t('创建便利贴')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notes.map((note) => {
            const colors = getColorClasses(note.color);
            const preview = getPreview(note.content);

            return (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note.id)}
                className={`group relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${colors.bg} ${colors.border}`}
              >
                {/* 删除按钮 */}
                <button
                  type="button"
                  onClick={(e) => showDeleteConfirm(note.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/10 hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                  title={t("删除")}
                >
                  <Icon name="trash" size={14} className={colors.text} />
                </button>

                {/* 内容预览 */}
                <div className={`${colors.text} min-h-[100px]`}>
                  {preview ? (
                    <p className="text-sm whitespace-pre-wrap line-clamp-4">{preview}</p>
                  ) : (
                    <p className="text-sm opacity-50 italic">{t('空便利贴')}</p>
                  )}
                </div>

                {/* 底部信息 */}
                <div className={`mt-3 pt-3 border-t ${colors.border} flex items-center justify-between`}>
                  <span className={`text-xs opacity-60 ${colors.text}`}>
                    {formatDate(note.updatedAt?.toString() || note.createdAt?.toString() || '')}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${colors.bg.replace('100', '300')}`} />
                </div>
              </div>
            );
          })}

          {/* 添加新便利贴的占位卡片 */}
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-white/20 hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/5 transition-all min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              {creating ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7C3AED]"></div>
              ) : (
                <Icon name="plus" size={24} color="rgba(255,255,255,0.5)" />
              )}
            </div>
            <span className="text-white/50 text-sm">{t('创建新便利贴')}</span>
          </button>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirm.show && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={handleDeleteCancel}
        >
          <div
            className="glass-heavy p-6 rounded-xl shadow-xl max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-3">
                <Icon name="trash" size={24} color="#EF4444" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('确认删除')}</h3>
              <p className="text-white/60">{t('确定要删除这个便利贴吗？此操作无法撤销。')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {t('取消')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {t('删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { StickyWidget };

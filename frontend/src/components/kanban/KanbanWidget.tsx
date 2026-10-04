import { useState } from 'react';
import { useKanban } from './hooks/useKanban';
import { BoardList } from './BoardList';
import { BoardView } from './BoardView';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from '../Icon';
import { useToast } from '../../hooks/useToast';
import { t } from '@/i18n';

type View = 'list' | 'board';
type DialogType = 'none' | 'createBoard' | 'addColumn';

export function KanbanWidget(): JSX.Element {
  const [view, setView] = useState<View>('list');
  const [dialogType, setDialogType] = useState<DialogType>('none');
  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);
  const kanban = useKanban();
  const toast = useToast();

  const handleCreateBoard = async (name: string) => {
    if (!name.trim()) {
      toast.error(t('请输入看板名称'));
      return;
    }
    const board = await kanban.createBoard(name.trim(), '');
    if (board) {
      toast.success(t('看板创建成功'));
      kanban.selectBoard(board.id);
      setView('board');
    } else if (kanban.error) {
      toast.error(kanban.error);
      kanban.clearError();
    }
  };

  const handleAddColumn = async (name: string) => {
    if (!name.trim()) {
      toast.error(t('请输入列名称'));
      return;
    }
    if (kanban.currentBoard) {
      const result = await kanban.createColumn(kanban.currentBoard.id, name.trim());
      if (result) {
        toast.success(t('列创建成功'));
      } else if (kanban.error) {
        toast.error(kanban.error);
        kanban.clearError();
      }
    }
  };

  const handleSelectBoard = async (boardId: string) => {
    await kanban.selectBoard(boardId);
    setView('board');
  };

  const handleBackToList = () => {
    setView('list');
  };

  const handleDeleteBoard = async (boardId: string) => {
    setDeleteBoardId(boardId);
  };

  const handleConfirmDeleteBoard = async () => {
    if (deleteBoardId) {
      await kanban.deleteBoard(deleteBoardId);
      toast.success(t('看板已删除'));
      setDeleteBoardId(null);
    }
  };

  if (kanban.loading && kanban.boards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C3AED]"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0D0F1A]">
        <div className="flex items-center gap-3">
          {view === 'board' && (
            <button
              onClick={handleBackToList}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <Icon name="arrow-left" size={20} />
            </button>
          )}
          <h2 className="text-lg font-semibold text-white">
            {view === 'list' ? t('看板管理') : kanban.currentBoard?.name || t('看板')}
          </h2>
        </div>

        {view === 'list' && (
          <button
            onClick={() => setDialogType('createBoard')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors clickable"
          >
            <Icon name="plus" size={16} />
            <span>{t('新建看板')}</span>
          </button>
        )}

        {view === 'board' && kanban.currentBoard && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDialogType('addColumn')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors clickable"
            >
              <Icon name="plus" size={16} />
              <span>{t('添加列')}</span>
            </button>
            <button
              onClick={() => handleDeleteBoard(kanban.currentBoard!.id)}
              className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-white/40 hover:text-[#EF4444] transition-colors"
              title={t("删除看板")}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Content - 可滚动区域 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {view === 'list' ? (
          <BoardList
            boards={kanban.boards}
            onSelect={handleSelectBoard}
            onDelete={handleDeleteBoard}
          />
        ) : kanban.currentBoard ? (
          <BoardView
            board={kanban.currentBoard}
            kanban={kanban}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <Icon name="kanban" size={48} className="mb-4 opacity-50" />
            <p>{t('请选择一个看板')}</p>
          </div>
        )}
      </div>

      {/* Input Dialogs */}
      <InputDialog
        isOpen={dialogType === 'createBoard'}
        title={t("新建看板")}
        placeholder={t("请输入看板名称")}
        onConfirm={handleCreateBoard}
        onCancel={() => setDialogType('none')}
      />

      <InputDialog
        isOpen={dialogType === 'addColumn'}
        title={t("添加列")}
        placeholder={t("请输入列名称")}
        onConfirm={handleAddColumn}
        onCancel={() => setDialogType('none')}
      />

      <ConfirmDialog
        isOpen={deleteBoardId !== null}
        title={t("删除看板")}
        message={t("确定要删除这个看板吗？所有数据将被删除。")}
        onConfirm={handleConfirmDeleteBoard}
        onCancel={() => setDeleteBoardId(null)}
      />

      {/* Error Toast */}
      {kanban.error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm z-50">
          {kanban.error}
        </div>
      )}
    </div>
  );
}

export default KanbanWidget;

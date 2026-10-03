import { useState } from 'react';
import { useKanban } from './hooks/useKanban';
import { BoardList } from './BoardList';
import { BoardView } from './BoardView';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from '../Icon';
import { Button, IconButton } from '../ui';
import { useToast } from '../../hooks/useToast';

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
      toast.error('请输入看板名称');
      return;
    }
    const board = await kanban.createBoard(name.trim(), '');
    if (board) {
      toast.success('看板创建成功');
      kanban.selectBoard(board.id);
      setView('board');
    } else if (kanban.error) {
      toast.error(kanban.error);
      kanban.clearError();
    }
  };

  const handleAddColumn = async (name: string) => {
    if (!name.trim()) {
      toast.error('请输入列名称');
      return;
    }
    if (kanban.currentBoard) {
      const result = await kanban.createColumn(kanban.currentBoard.id, name.trim());
      if (result) {
        toast.success('列创建成功');
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
      toast.success('看板已删除');
      setDeleteBoardId(null);
    }
  };

  if (kanban.loading && kanban.boards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Fixed Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-surface-0 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {view === 'board' && (
            <IconButton name="arrow-left" label="返回看板列表" size="sm" onClick={handleBackToList} />
          )}
          <h2 className="truncate text-[15px] font-semibold text-text-1">
            {view === 'list' ? '看板管理' : kanban.currentBoard?.name || '看板'}
          </h2>
        </div>

        {view === 'list' && (
          <Button variant="primary" size="sm" icon="plus" onClick={() => setDialogType('createBoard')}>
            新建看板
          </Button>
        )}

        {view === 'board' && kanban.currentBoard && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon="plus" onClick={() => setDialogType('addColumn')}>
              添加列
            </Button>
            <IconButton name="trash" label="删除看板" size="sm" onClick={() => handleDeleteBoard(kanban.currentBoard!.id)} />
          </div>
        )}
      </div>

      {/* Content - 可滚动区域 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          <div className="flex h-full flex-col items-center justify-center text-text-4">
            <Icon name="view-columns" size={40} className="mb-3 opacity-50" />
            <p className="text-[12.5px]">请选择一个看板</p>
          </div>
        )}
      </div>

      {/* Input Dialogs */}
      <InputDialog
        isOpen={dialogType === 'createBoard'}
        title="新建看板"
        placeholder="请输入看板名称"
        onConfirm={handleCreateBoard}
        onCancel={() => setDialogType('none')}
      />

      <InputDialog
        isOpen={dialogType === 'addColumn'}
        title="添加列"
        placeholder="请输入列名称"
        onConfirm={handleAddColumn}
        onCancel={() => setDialogType('none')}
      />

      <ConfirmDialog
        isOpen={deleteBoardId !== null}
        title="删除看板"
        message="确定要删除这个看板吗？所有数据将被删除。"
        onConfirm={handleConfirmDeleteBoard}
        onCancel={() => setDeleteBoardId(null)}
      />

      {/* Error Toast */}
      {kanban.error && (
        <div
          className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[8px] px-3.5 py-2 text-[12.5px]"
          style={{ background: 'var(--color-surface-4)', border: '1px solid rgba(255,69,58,0.3)', color: 'var(--color-error-text)', boxShadow: 'var(--shadow-pop)' }}
        >
          {kanban.error}
        </div>
      )}
    </div>
  );
}

export default KanbanWidget;

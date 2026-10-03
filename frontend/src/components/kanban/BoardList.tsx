import { Board } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import { EmptyState } from '../ui';

interface BoardListProps {
  boards: Board[];
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
}

export function BoardList({ boards, onSelect, onDelete }: BoardListProps): JSX.Element {
  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalCards = (board: Board): number => {
    return board.columns.reduce((sum, col) => sum + col.cards.length, 0);
  };

  if (boards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon="view-columns" title="还没有看板" description='点击右上角"新建看板"开始' />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
      {boards.map(board => (
        <div
          key={board.id}
          className="card card-hover group cursor-pointer p-4"
          onClick={() => onSelect(board.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSelect(board.id);
          }}
        >
          {/* Board Header */}
          <div className="mb-2.5 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13.5px] font-semibold text-text-1">{board.name}</h3>
              {board.description && (
                <p className="mt-0.5 truncate text-[11.5px] text-text-3">{board.description}</p>
              )}
            </div>
          </div>

          {/* Board Stats */}
          <div className="tnum mb-3 flex items-center gap-3.5 text-[11px] text-text-3">
            <span className="flex items-center gap-1">
              <Icon name="view-columns" size={12} />
              {board.columns.length} 列
            </span>
            <span className="flex items-center gap-1">
              <Icon name="square" size={12} />
              {getTotalCards(board)} 卡片
            </span>
            <span className="flex items-center gap-1">
              <Icon name="tag" size={12} />
              {board.labels.length} 标签
            </span>
          </div>

          {/* Column Preview */}
          <div className="mb-3 flex gap-1.5">
            {board.columns.slice(0, 5).map((col, index) => (
              <div
                key={col.id}
                className="h-1 flex-1 rounded-full"
                style={{
                  background: 'var(--color-text-4)',
                  opacity: 0.25 + index * 0.15,
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="tnum text-[11px] text-text-4">
              {formatDate(board.updatedAt)}
            </span>

            {/* Actions */}
            <div className="flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(board.id);
                }}
                className="icon-btn icon-btn-sm"
                title="删除看板"
                style={{ color: 'var(--color-error-text)' }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { Board } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface BoardListProps {
  boards: Board[];
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
}

export function BoardList({ boards, onSelect, onDelete }: BoardListProps): JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
      <div className="flex flex-col items-center justify-center h-full text-white/40">
        <Icon name="kanban" size={64} className="mb-4 opacity-30" />
        <p className="text-lg mb-2">{t('还没有看板')}</p>
        <p className="text-sm">{t('点击右上角"新建看板"开始')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
      {boards.map(board => (
        <div
          key={board.id}
          className="glass-light p-4 rounded-xl cursor-pointer transition-all duration-200 group"
          onMouseEnter={() => setHoveredId(board.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onSelect(board.id)}
        >
          {/* Board Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-lg truncate">{board.name}</h3>
              {board.description && (
                <p className="text-sm text-white/50 truncate mt-1">{board.description}</p>
              )}
            </div>
          </div>

          {/* Board Stats */}
          <div className="flex items-center gap-4 text-xs text-white/40 mb-3">
            <div className="flex items-center gap-1.5">
              <Icon name="view-columns" size={14} />
              <span>{board.columns.length} {t('列')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="square" size={14} />
              <span>{getTotalCards(board)} {t('卡片')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="tag" size={14} />
              <span>{board.labels.length} {t('标签')}</span>
            </div>
          </div>

          {/* Column Preview */}
          <div className="flex gap-1.5 mb-3">
            {board.columns.slice(0, 5).map((col, index) => (
              <div
                key={col.id}
                className="flex-1 h-1.5 rounded-full bg-white/10"
                style={{
                  width: `${100 / Math.min(board.columns.length, 5)}%`,
                  opacity: 0.3 + (index * 0.15),
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">
              {formatDate(board.updatedAt)}
            </span>

            {/* Actions */}
            <div className={`flex items-center gap-1 transition-opacity ${
              hoveredId === board.id ? 'opacity-100' : 'opacity-0'
            }`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(board.id);
                }}
                className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-[#EF4444]/10 hover:text-[#EF4444] clickable"
                title={t("删除看板")}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default BoardList;

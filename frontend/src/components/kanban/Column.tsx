import { useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column, Card, Label, Priority } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';

interface KanbanColumnProps {
  column: Column;
  labels: Label[];
  onAddCard: () => void;
  onDeleteColumn: () => void;
  onCardClick: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
}

interface SortableCardProps {
  card: Card;
  labels: Label[];
  columnId: string;
  onClick: () => void;
  onDelete: () => void;
}

const priorityColors: Record<string, string> = {
  [Priority.PriorityHigh]: 'var(--color-error-text)',
  [Priority.PriorityMedium]: 'var(--color-warning-text)',
  [Priority.PriorityLow]: 'var(--color-success-text)',
};

const priorityLabels: Record<string, string> = {
  [Priority.PriorityHigh]: '高',
  [Priority.PriorityMedium]: '中',
  [Priority.PriorityLow]: '低',
};

function SortableCard({ card, labels, columnId, onClick, onDelete }: SortableCardProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
      columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardLabels = labels.filter(l => (card.labels || []).includes(l.id));
  const completedChecklists = card.checklists.filter(c => c.completed).length;
  const totalChecklists = card.checklists.length;
  const isOverdue = card.dueDate && new Date(card.dueDate as string | Date) < new Date() && !card.completedAt;
  const isCompleted = !!card.completedAt;

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === -1) return '昨天';
    if (diffDays < 0) return `${Math.abs(diffDays)}天前`;
    if (diffDays <= 7) return `${diffDays}天后`;

    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        card group relative cursor-pointer p-3 transition-colors duration-150 hover:border-hairline-strong
        ${isDragging ? 'opacity-50' : ''}
        ${isCompleted ? 'opacity-60' : ''}
      `}
    >
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="icon-btn icon-btn-sm absolute right-1.5 top-1.5 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        title="删除卡片"
      >
        <Icon name="close" size={12} />
      </button>

      {/* Labels(label.color 是用户自定义数据色,保留) */}
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className={`mb-1.5 pr-6 text-[12.5px] font-medium leading-snug ${isCompleted ? 'text-text-3 line-through' : 'text-text-1'}`}>
        {card.title}
      </h4>

      {/* Description Preview */}
      {card.description && (
        <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-text-3">
          {card.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Priority */}
          {card.priority && priorityColors[card.priority] && (
            <span
              className="rounded px-1.5 py-0.5 text-[10.5px]"
              style={{
                color: priorityColors[card.priority],
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {priorityLabels[card.priority]}
            </span>
          )}

          {/* Due Date */}
          {card.dueDate && (
            <div className={`tnum flex items-center gap-1 text-[10.5px] ${
              isOverdue ? 'text-error-text' : 'text-text-4'
            }`}>
              <Icon name="clock" size={11} />
              <span>{formatDate(card.dueDate as string | Date)}</span>
            </div>
          )}

          {/* Checklists */}
          {totalChecklists > 0 && (
            <div className={`tnum flex items-center gap-1 text-[10.5px] ${
              completedChecklists === totalChecklists ? 'text-success-text' : 'text-text-4'
            }`}>
              <Icon name={completedChecklists === totalChecklists ? 'check-circle' : 'circle'} size={11} />
              <span>{completedChecklists}/{totalChecklists}</span>
            </div>
          )}
        </div>

        {/* Completed indicator */}
        {isCompleted && (
          <div className="text-success-text">
            <Icon name="check-circle" size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanColumn({
  column,
  labels,
  onAddCard,
  onDeleteColumn,
  onCardClick,
  onDeleteCard,
}: KanbanColumnProps): JSX.Element {
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // 阻止卡片区域的滚轮事件冒泡，使其进行垂直滚动
  useEffect(() => {
    const container = cardsContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      // 让默认的垂直滚动行为生效
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Make column droppable
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-72 shrink-0 flex-col rounded-[10px] transition-colors duration-150 ${
        isOver ? 'bg-accent-subtle' : 'bg-surface-1'
      }`}
    >
      {/* Column Header */}
      <div className="group/header flex shrink-0 items-center justify-between border-b border-hairline px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="truncate text-[12.5px] font-medium text-text-1">{column.name}</h3>
          <span className="tnum shrink-0 text-[11px] text-text-4">
            {column.cards.length}
          </span>
        </div>

        <div className="flex items-center opacity-0 transition-opacity duration-150 group-hover/header:opacity-100">
          <button
            onClick={onDeleteColumn}
            className="icon-btn icon-btn-sm"
            title="删除列"
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>

      {/* Cards Container */}
      <div
        ref={cardsContainerRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
      >
        <SortableContext
          items={column.cards.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map(card => (
            <SortableCard
              key={card.id}
              card={card}
              labels={labels}
              columnId={column.id}
              onClick={() => onCardClick(card)}
              onDelete={() => onDeleteCard(card)}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add Card Button */}
      <div className="shrink-0 border-t border-hairline p-2">
        <button
          onClick={onAddCard}
          className="flex w-full items-center justify-center gap-1.5 rounded-[6px] py-1.5 text-[12px] text-text-4 transition-colors duration-150 hover:bg-white/[0.045] hover:text-text-2"
        >
          <Icon name="plus" size={13} />
          <span>添加卡片</span>
        </button>
      </div>
    </div>
  );
}

export default KanbanColumn;

import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column, Card, Label } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import { t } from '@/i18n';

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

  const [isHovered, setIsHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardLabels = labels.filter(l => card.labels.includes(l.id));
  const completedChecklists = card.checklists.filter(c => c.completed).length;
  const totalChecklists = card.checklists.length;
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.completedAt;
  const isCompleted = !!card.completedAt;

  const priorityColors: Record<string, string> = {
    'high': '#EF4444',
    'medium': '#F59E0B',
    'low': '#22C55E',
  };

  const priorityLabels: Record<string, string> = {
    'high': t('高'),
    'medium': t('中'),
    'low': t('低'),
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('今天');
    if (diffDays === 1) return t('明天');
    if (diffDays === -1) return t('昨天');
    if (diffDays < 0) return t('{n}天前', { n: Math.abs(diffDays) });
    if (diffDays <= 7) return t('{n}天后', { n: diffDays });

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        bg-[#1E1E2E] rounded-lg p-3 cursor-pointer transition-all duration-200
        hover:bg-[#252536] group relative
        ${isDragging ? 'opacity-50 shadow-lg scale-[1.02]' : ''}
        ${isCompleted ? 'opacity-60' : ''}
      `}
    >
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className={`absolute top-2 right-2 p-1 rounded hover:bg-[#EF4444]/10 text-white/40 hover:text-[#EF4444] transition-all z-10 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
        title={t("删除卡片")}
      >
        <Icon name="close" size={14} />
      </button>

      {/* Labels */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className="px-2 py-0.5 rounded text-xs font-medium"
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
      <h4 className={`text-sm font-medium mb-2 pr-6 ${isCompleted ? 'line-through text-white/50' : 'text-white'}`}>
        {card.title}
      </h4>

      {/* Description Preview */}
      {card.description && (
        <p className="text-xs text-white/40 mb-2 line-clamp-2">
          {card.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {/* Priority */}
          {card.priority && priorityColors[card.priority] && (
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{
                backgroundColor: `${priorityColors[card.priority]}20`,
                color: priorityColors[card.priority],
              }}
            >
              {priorityLabels[card.priority]}
            </span>
          )}

          {/* Due Date */}
          {card.dueDate && (
            <div className={`flex items-center gap-1 text-xs ${
              isOverdue ? 'text-[#EF4444]' : 'text-white/40'
            }`}>
              <Icon name="clock" size={12} />
              <span>{formatDate(card.dueDate)}</span>
            </div>
          )}

          {/* Checklists */}
          {totalChecklists > 0 && (
            <div className={`flex items-center gap-1 text-xs ${
              completedChecklists === totalChecklists ? 'text-[#22C55E]' : 'text-white/40'
            }`}>
              <Icon name={completedChecklists === totalChecklists ? 'check-circle' : 'circle'} size={12} />
              <span>{completedChecklists}/{totalChecklists}</span>
            </div>
          )}
        </div>

        {/* Completed indicator */}
        {isCompleted && (
          <div className="text-[#22C55E]">
            <Icon name="check-circle" size={16} />
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
  const [isHovered, setIsHovered] = useState(false);
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
      className={`flex-shrink-0 w-72 h-full flex flex-col bg-white/5 rounded-xl transition-colors ${
        isOver ? 'bg-white/10' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-medium text-white truncate">{column.name}</h3>
            <span className="text-xs text-white/40 flex-shrink-0">
              {column.cards.length}
            </span>
          </div>

          <div className={`flex items-center gap-1 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <button
              onClick={onDeleteColumn}
              className="p-1 rounded hover:bg-[#EF4444]/10 text-white/40 hover:text-[#EF4444] transition-colors"
              title={t("删除列")}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Container - with visible scrollbar */}
      <div
        ref={cardsContainerRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0 scrollbar-gutter-stable"
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
      <div className="p-2 border-t border-white/5 flex-shrink-0">
        <button
          onClick={onAddCard}
          className="w-full py-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5 text-sm"
        >
          <Icon name="plus" size={16} />
          <span>{t('添加卡片')}</span>
        </button>
      </div>
    </div>
  );
}

export default KanbanColumn;

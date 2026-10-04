import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Label, Priority } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface KanbanCardProps {
  card: Card;
  labels: Label[];
  onClick: () => void;
  isDragging?: boolean;
}

const priorityColors: Record<string, string> = {
  [Priority.PriorityHigh]: '#EF4444',
  [Priority.PriorityMedium]: '#F59E0B',
  [Priority.PriorityLow]: '#22C55E',
};

const priorityLabels: Record<string, string> = {
  [Priority.PriorityHigh]: t('高'),
  [Priority.PriorityMedium]: t('中'),
  [Priority.PriorityLow]: t('低'),
};

export function KanbanCard({ card, labels, onClick, isDragging }: KanbanCardProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardLabels = labels.filter(l => card.labels.includes(l.id));
  const completedChecklists = card.checklists.filter(c => c.completed).length;
  const totalChecklists = card.checklists.length;

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.completedAt;
  const isCompleted = !!card.completedAt;

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        bg-[#1E1E2E] rounded-lg p-3 cursor-pointer transition-all duration-200
        hover:bg-[#252536] group
        ${isSortableDragging || isDragging ? 'opacity-50 shadow-lg scale-[1.02]' : ''}
        ${isCompleted ? 'opacity-60' : ''}
      `}
    >
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
      <h4 className={`text-sm font-medium mb-2 ${isCompleted ? 'line-through text-white/50' : 'text-white'}`}>
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

export default KanbanCard;

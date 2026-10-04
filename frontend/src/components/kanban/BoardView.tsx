import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Board, Card, Column as ColumnType, Priority, CardUpdate } from '../../../bindings/ltools/plugins/kanban/models';
import { UseKanbanReturn } from './hooks/useKanban';
import { KanbanColumn } from './Column';
import { AddCardDialog } from './AddCardDialog';
import { CardEditor } from './CardEditor';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from '../Icon';
import { t } from '@/i18n';

interface BoardViewProps {
  board: Board;
  kanban: UseKanbanReturn;
}

export function BoardView({ board, kanban }: BoardViewProps): JSX.Element {
  const [addCardColumnId, setAddCardColumnId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<{ card: Card; columnId: string } | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 横向滚动支持 - 将垂直滚轮转换为水平滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 添加卡片
  const handleConfirmAddCard = async (title: string, priority: Priority) => {
    if (title.trim() && addCardColumnId) {
      await kanban.createCard(board.id, addCardColumnId, title.trim(), priority);
    }
    setAddCardColumnId(null);
  };

  // 添加列
  const handleConfirmAddColumn = async (name: string) => {
    if (name.trim()) {
      await kanban.createColumn(board.id, name.trim());
    }
    setShowAddColumn(false);
  };

  // 删除列
  const handleConfirmDeleteColumn = async () => {
    if (deleteColumnId) {
      await kanban.deleteColumn(board.id, deleteColumnId);
    }
    setDeleteColumnId(null);
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === 'card') {
      setActiveCard(activeData.card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || activeData.type !== 'card') return;

    const activeCard = activeData.card as Card;
    const activeColumnId = activeData.columnId as string;

    // 拖到列上
    if (overData?.type === 'column') {
      const overColumnId = overData.column.id as string;
      if (activeColumnId !== overColumnId) {
        kanban.moveCard(board.id, activeColumnId, overColumnId, activeCard.id, 0);
      }
    }
    // 拖到卡片上
    else if (overData?.type === 'card') {
      const overCard = overData.card as Card;
      const overColumnId = overData.columnId as string;

      if (activeCard.id !== overCard.id) {
        // 找到目标位置
        const targetColumn = board.columns.find(c => c.id === overColumnId);
        if (targetColumn) {
          const targetIndex = targetColumn.cards.findIndex(c => c.id === overCard.id);
          if (activeColumnId === overColumnId) {
            // 同列内排序
            kanban.moveCard(board.id, activeColumnId, overColumnId, activeCard.id, targetIndex);
          } else {
            // 跨列移动
            kanban.moveCard(board.id, activeColumnId, overColumnId, activeCard.id, targetIndex);
          }
        }
      }
    }
  };

  // 处理卡片点击 - 打开编辑器
  const handleCardClick = (card: Card, columnId: string) => {
    setEditingCard({ card, columnId });
  };

  // 处理卡片删除 - 从列中删除
  const handleDeleteCardFromColumn = async (card: Card) => {
    // 找到卡片所在的列
    const column = board.columns.find(col =>
      col.cards.some(c => c.id === card.id)
    );
    if (column) {
      await kanban.deleteCard(board.id, column.id, card.id);
    }
  };

  // 保存卡片编辑
  const handleSaveCard = async (updates: CardUpdate) => {
    if (editingCard) {
      await kanban.updateCard(
        board.id,
        editingCard.columnId,
        editingCard.card.id,
        updates
      );
      setEditingCard(null);
    }
  };

  // 删除卡片
  const handleDeleteCard = async () => {
    if (editingCard) {
      await kanban.deleteCard(board.id, editingCard.columnId, editingCard.card.id);
      setEditingCard(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={scrollContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
        <div className="flex gap-4 p-4 h-full items-start">
          {board.columns.map((column: ColumnType) => (
            <KanbanColumn
              key={column.id}
              column={column}
              labels={board.labels}
              onAddCard={() => setAddCardColumnId(column.id)}
              onDeleteColumn={() => setDeleteColumnId(column.id)}
              onCardClick={(card) => handleCardClick(card, column.id)}
              onDeleteCard={handleDeleteCardFromColumn}
            />
          ))}

          {/* Add Column Button */}
          <div className="flex-shrink-0 w-72 flex-none">
            <button
              onClick={() => setShowAddColumn(true)}
              className="w-full h-12 rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-2 clickable"
            >
              <Icon name="plus" size={20} />
              <span>{t('添加列')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeCard ? (
          <div className="w-64 bg-[#1E1E2E] rounded-lg p-3 shadow-xl opacity-90">
            <h4 className="text-sm font-medium text-white">{activeCard.title}</h4>
          </div>
        ) : null}
      </DragOverlay>

      {/* Dialogs */}
      <AddCardDialog
        isOpen={addCardColumnId !== null}
        onConfirm={handleConfirmAddCard}
        onCancel={() => setAddCardColumnId(null)}
      />

      <InputDialog
        isOpen={showAddColumn}
        title={t("添加列")}
        placeholder={t("请输入列名称")}
        onConfirm={handleConfirmAddColumn}
        onCancel={() => setShowAddColumn(false)}
      />

      <ConfirmDialog
        isOpen={deleteColumnId !== null}
        title={t("删除列")}
        message={t("确定要删除这一列吗？所有卡片将被删除。")}
        onConfirm={handleConfirmDeleteColumn}
        onCancel={() => setDeleteColumnId(null)}
      />

      {/* Card Editor */}
      {editingCard && (
        <CardEditor
          card={editingCard.card}
          labels={board.labels}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setEditingCard(null)}
          onUpdateChecklist={(itemId, completed) => {
            kanban.toggleChecklistItem(
              board.id,
              editingCard.columnId,
              editingCard.card.id,
              itemId
            );
          }}
          onAddChecklistItem={(text) => {
            kanban.addChecklistItem(
              board.id,
              editingCard.columnId,
              editingCard.card.id,
              text
            );
          }}
          onRemoveChecklistItem={(itemId) => {
            kanban.removeChecklistItem(
              board.id,
              editingCard.columnId,
              editingCard.card.id,
              itemId
            );
          }}
          onCreateLabel={(name, color) => {
            kanban.createLabel(board.id, name, color);
          }}
          onUpdateCardLabels={(labelIds) => {
            kanban.updateCard(board.id, editingCard.columnId, editingCard.card.id, {
              labels: labelIds
            });
          }}
        />
      )}
    </DndContext>
  );
}

export default BoardView;

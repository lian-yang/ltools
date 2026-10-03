import { useState, useEffect, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { zhCN } from 'date-fns/locale/zh-CN';
import { Card, Label, Priority, ChecklistItem, CardUpdate } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import { Button, IconButton, Input, Textarea } from '../ui';
import 'react-datepicker/dist/react-datepicker.css';

// 注册中文语言包
registerLocale('zh-CN', zhCN);

interface CardEditorProps {
  card: Card;
  labels: Label[];
  onSave: (updates: CardUpdate) => void;
  onDelete: () => void;
  onClose: () => void;
  onUpdateChecklist: (itemId: string, completed: boolean) => void;
  onAddChecklistItem: (text: string) => void;
  onRemoveChecklistItem: (itemId: string) => void;
  onCreateLabel: (name: string, color: string) => void;
  onUpdateCardLabels: (labelIds: string[]) => void;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: Priority.PriorityHigh, label: '高', color: 'var(--color-error-text)' },
  { value: Priority.PriorityMedium, label: '中', color: 'var(--color-warning-text)' },
  { value: Priority.PriorityLow, label: '低', color: 'var(--color-success-text)' },
];

const labelColors = [
  '#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2',
  '#FF375F', '#64D2FF', '#32D74B', '#FF9F0A', '#5E5CE6',
];

export function CardEditor({
  card,
  labels,
  onSave,
  onDelete,
  onClose,
  onUpdateChecklist,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onCreateLabel,
  onUpdateCardLabels,
}: CardEditorProps): JSX.Element {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState<Priority>(card.priority || Priority.PriorityMedium);
  const [dueDate, setDueDate] = useState<Date | null>(
    card.dueDate ? new Date(card.dueDate as string | Date) : null
  );
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(labelColors[0]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(card.labels || []);
  // 本地维护子任务状态，实现即时UI更新
  const [checklists, setChecklists] = useState<ChecklistItem[]>(card.checklists || []);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
    setPriority(card.priority || Priority.PriorityMedium);
    setDueDate(card.dueDate ? new Date(card.dueDate as string | Date) : null);
    setSelectedLabels(card.labels || []);
    setChecklists(card.checklists || []);
  }, [card]);

  const handleSave = () => {
    const updates: CardUpdate = {
      title: title.trim(),
      description: description.trim(),
      priority: priority,
      labels: selectedLabels,
    };

    if (dueDate) {
      // Go 端 *time.Time 期望 RFC3339 字符串
      updates.dueDate = dueDate.toISOString();
    }

    onSave(updates);
  };

  const handleToggleLabel = (labelId: string) => {
    const newLabels = selectedLabels.includes(labelId)
      ? selectedLabels.filter(id => id !== labelId)
      : [...selectedLabels, labelId];
    setSelectedLabels(newLabels);
    onUpdateCardLabels(newLabels);
  };

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      onCreateLabel(newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setShowNewLabel(false);
    }
  };

  const handleAddChecklist = () => {
    if (newChecklistText.trim()) {
      // 先更新本地状态
      const newItem: ChecklistItem = {
        id: `temp-${Date.now()}`,
        text: newChecklistText.trim(),
        completed: false,
      };
      setChecklists(prev => [...prev, newItem]);
      // 然后调用后端
      onAddChecklistItem(newChecklistText.trim());
      setNewChecklistText('');
    }
  };

  const handleToggleChecklist = (itemId: string, completed: boolean) => {
    // 先更新本地状态
    setChecklists(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed } : item
      )
    );
    // 然后调用后端
    onUpdateChecklist(itemId, completed);
  };

  const handleRemoveChecklist = (itemId: string) => {
    // 先更新本地状态
    setChecklists(prev => prev.filter(item => item.id !== itemId));
    // 然后调用后端
    onRemoveChecklistItem(itemId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return '选择日期';
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return '今天';
    if (date.toDateString() === tomorrow.toDateString()) return '明天';
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="scrim absolute inset-0" onClick={onClose} />

      {/* Dialog */}
      <div
        className="glass-heavy animate-scale-in relative flex max-h-[90vh] w-[560px] max-w-[95vw] flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Fixed Header */}
        <div className="hairline-b flex shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <IconButton name="arrow-left" label="返回" size="sm" onClick={onClose} />
            <h3 className="text-[14px] font-semibold text-text-1">编辑卡片</h3>
          </div>
          <IconButton name="trash" label="删除卡片" size="sm" onClick={onDelete} />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Title */}
          <div>
            <label className="field-label">标题</label>
            <Input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入卡片标题…"
            />
          </div>

          {/* Description */}
          <div>
            <label className="field-label">描述</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="添加详细描述…"
            />
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="field-label">优先级</label>
              <div className="flex gap-2">
                {priorityOptions.map((option) => {
                  const active = priority === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value)}
                      className="flex-1 rounded-[6px] border px-2 py-1.5 text-[12px] font-medium transition-colors duration-150"
                      style={{
                        borderColor: active ? option.color : 'var(--color-hairline-strong)',
                        backgroundColor: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                        color: active ? option.color : 'var(--color-text-3)',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date with DatePicker */}
            <div>
              <label className="field-label">截止日期</label>
              <DatePicker
                selected={dueDate}
                onChange={(date: Date | null) => setDueDate(date)}
                locale="zh-CN"
                dateFormat="yyyy年MM月dd日"
                placeholderText="选择日期"
                className="w-full"
                customInput={
                  <button
                    type="button"
                    className={`input flex h-8 items-center justify-between text-left ${
                      dueDate ? 'text-text-1' : 'text-text-4'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar" size={13} color={dueDate ? 'var(--color-accent-text)' : 'var(--color-text-4)'} />
                      {formatDateDisplay(dueDate)}
                    </span>
                    {dueDate && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setDueDate(null);
                        }}
                        className="text-text-4 transition-colors hover:text-text-2"
                      >
                        <Icon name="close" size={12} />
                      </span>
                    )}
                  </button>
                }
                popperClassName="kanban-datepicker-popper"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] font-medium text-text-2">标签</label>
              <button
                type="button"
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="text-[11.5px] text-accent-text transition-colors hover:text-accent-hover"
              >
                {showLabelPicker ? '收起' : '管理标签'}
              </button>
            </div>

            {/* Selected Labels */}
            <div className="mb-2 flex min-h-[28px] flex-wrap gap-1.5">
              {selectedLabels.map(labelId => {
                const label = labels.find(l => l.id === labelId);
                if (!label) return null;
                return (
                  <span
                    key={label.id}
                    className="cursor-pointer rounded-[5px] px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                    }}
                    onClick={() => handleToggleLabel(label.id)}
                  >
                    {label.name} ×
                  </span>
                );
              })}
              {selectedLabels.length === 0 && (
                <span className="py-1 text-[11.5px] text-text-4">点击管理标签添加</span>
              )}
            </div>

            {/* Label Picker */}
            {showLabelPicker && (
              <div className="card-inset space-y-3 p-3.5">
                {/* Existing Labels */}
                <div className="flex flex-wrap gap-1.5">
                  {labels.map(label => {
                    const selected = selectedLabels.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleToggleLabel(label.id)}
                        className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium transition-opacity ${
                          selected ? 'ring-1 ring-white/40' : 'opacity-50 hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: `${label.color}20`,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>

                {/* New Label Form */}
                {showNewLabel ? (
                  <div className="hairline-t space-y-2.5 pt-3">
                    <Input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="标签名称"
                    />
                    <div className="flex flex-wrap gap-2">
                      {labelColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLabelColor(color)}
                          className={`h-6 w-6 rounded-[6px] transition-transform ${
                            newLabelColor === color ? 'scale-110 ring-2 ring-white/50' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="primary" size="sm" onClick={handleCreateLabel}>
                        创建
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewLabel(false)}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewLabel(true)}
                    className="flex items-center gap-1 text-[11.5px] text-accent-text transition-colors hover:text-accent-hover"
                  >
                    <Icon name="plus" size={11} />
                    新建标签
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <label className="field-label">
              子任务
              {checklists.length > 0 && (
                <span className="tnum ml-2 text-[11px] text-text-4">
                  ({checklists.filter(c => c.completed).length}/{checklists.length})
                </span>
              )}
            </label>

            {/* Checklist Items */}
            {checklists.length > 0 && (
              <div className="card-inset mb-2.5 space-y-0.5 p-2.5">
                {checklists.map((item: ChecklistItem) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2.5 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(item.id, !item.completed)}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150"
                      style={{
                        borderColor: item.completed ? 'var(--color-success)' : 'var(--color-hairline-strong)',
                        background: item.completed ? 'var(--color-success)' : 'transparent',
                      }}
                      aria-label={item.completed ? '取消完成' : '标记完成'}
                    >
                      {item.completed && (
                        <Icon name="check" size={10} color="#0b0d11" />
                      )}
                    </button>
                    <span className={`min-w-0 flex-1 select-text text-[12.5px] transition-colors ${
                      item.completed ? 'text-text-4 line-through' : 'text-text-1'
                    }`}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklist(item.id)}
                      className="icon-btn icon-btn-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      title="删除子任务"
                    >
                      <Icon name="close" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Checklist Item */}
            <div className="flex gap-2">
              <Input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                placeholder="添加子任务…"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddChecklist}
                disabled={!newChecklistText.trim()}
              >
                添加
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="hairline-t flex shrink-0 justify-end gap-2 px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave}>
            保存更改
          </Button>
        </div>
      </div>

      {/* Custom DatePicker Styles */}
      <style>{`
        .kanban-datepicker-popper {
          z-index: 1000 !important;
        }
        .react-datepicker {
          background: var(--color-surface-3) !important;
          border: 1px solid var(--color-hairline-strong) !important;
          border-radius: 10px !important;
          font-family: var(--font-ui) !important;
          box-shadow: var(--shadow-pop) !important;
        }
        .react-datepicker__header {
          background: var(--color-surface-2) !important;
          border-bottom: 1px solid var(--color-hairline) !important;
          border-radius: 10px 10px 0 0 !important;
        }
        .react-datepicker__current-month {
          color: var(--color-text-1) !important;
          font-weight: 600 !important;
          padding: 8px 0 !important;
        }
        .react-datepicker__day-name {
          color: var(--color-text-3) !important;
          width: 30px !important;
          line-height: 30px !important;
        }
        .react-datepicker__day {
          color: var(--color-text-2) !important;
          width: 30px !important;
          line-height: 30px !important;
          border-radius: 6px !important;
          margin: 2px !important;
        }
        .react-datepicker__day:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: var(--color-text-1) !important;
        }
        .react-datepicker__day--selected {
          background: var(--color-accent) !important;
          color: #fff !important;
        }
        .react-datepicker__day--keyboard-selected {
          background: var(--color-accent-subtle) !important;
          color: var(--color-accent-text) !important;
        }
        .react-datepicker__day--today {
          border: 1px solid var(--color-accent) !important;
        }
        .react-datepicker__navigation-icon::before {
          border-color: var(--color-text-2) !important;
        }
        .react-datepicker__navigation {
          top: 12px !important;
        }
        .react-datepicker__navigation:hover *::before {
          border-color: var(--color-accent-text) !important;
        }
      `}</style>
    </div>
  );
}

export default CardEditor;

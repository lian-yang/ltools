import { useState, useEffect, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { zhCN } from 'date-fns/locale/zh-CN';
import { Card, Label, Priority, ChecklistItem, CardUpdate } from '../../../bindings/ltools/plugins/kanban/models';
import { Icon } from '../Icon';
import 'react-datepicker/dist/react-datepicker.css';
import { t } from '@/i18n';

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
  { value: Priority.PriorityHigh, label: t('高'), color: '#EF4444' },
  { value: Priority.PriorityMedium, label: t('中'), color: '#F59E0B' },
  { value: Priority.PriorityLow, label: t('低'), color: '#22C55E' },
];

const labelColors = [
  '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
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
    card.dueDate ? new Date(card.dueDate) : null
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
    setDueDate(card.dueDate ? new Date(card.dueDate) : null);
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
      updates.dueDate = dueDate;
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
    if (!date) return t('选择日期');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return t('今天');
    if (date.toDateString() === tomorrow.toDateString()) return t('明天');
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative glass-heavy rounded-xl w-[560px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        {/* Fixed Header - 使用绝对定位 */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-[#0D0F1A]/95 backdrop-blur-md rounded-t-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title={t("返回")}
            >
              <Icon name="arrow-left" size={20} />
            </button>
            <h3 className="text-lg font-semibold text-white">{t('编辑卡片')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-[#EF4444]/10 text-white/40 hover:text-[#EF4444] transition-colors"
              title={t("删除卡片")}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>

        {/* Content - 添加顶部 padding 为头部留出空间 */}
        <div className="flex-1 overflow-y-auto p-5 pt-[72px] space-y-5 scrollbar-thin">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t('标题')}</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/50 transition-all"
              placeholder={t("输入卡片标题...")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t('描述')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/50 transition-all resize-none"
              placeholder={t("添加详细描述...")}
            />
          </div>

          {/* Priority & Due Date - Two Column Layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('优先级')}</label>
              <div className="flex gap-2">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={`flex-1 px-2 py-2 rounded-lg border-2 transition-all ${
                      priority === option.value ? '' : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{
                      borderColor: priority === option.value ? option.color : undefined,
                      backgroundColor: priority === option.value ? `${option.color}15` : 'transparent',
                      color: priority === option.value ? option.color : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date with DatePicker */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('截止日期')}</label>
              <DatePicker
                selected={dueDate}
                onChange={(date: Date | null) => setDueDate(date)}
                locale="zh-CN"
                dateFormat={t("yyyy年MM月dd日")}
                placeholderText={t("选择日期")}
                className="w-full"
                customInput={
                  <button
                    type="button"
                    className={`w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-left transition-all hover:border-white/20 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/50 ${
                      dueDate ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon name="calendar" size={16} className={dueDate ? 'text-[#7C3AED]' : 'text-white/40'} />
                        {formatDateDisplay(dueDate)}
                      </span>
                      {dueDate && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setDueDate(null);
                          }}
                          className="text-white/40 hover:text-white/60"
                        >
                          <Icon name="close" size={14} />
                        </span>
                      )}
                    </div>
                  </button>
                }
                popperClassName="kanban-datepicker-popper"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">{t('标签')}</label>
              <button
                type="button"
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="text-xs text-[#7C3AED] hover:text-[#8B5CF6] transition-colors"
              >
                {showLabelPicker ? t('收起') : t('管理标签')}
              </button>
            </div>

            {/* Selected Labels */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {selectedLabels.map(labelId => {
                const label = labels.find(l => l.id === labelId);
                if (!label) return null;
                return (
                  <span
                    key={label.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all hover:opacity-80"
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
                <span className="text-xs text-white/30 py-1">{t('点击管理标签添加')}</span>
              )}
            </div>

            {/* Label Picker */}
            {showLabelPicker && (
              <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/5">
                {/* Existing Labels */}
                <div className="flex flex-wrap gap-1.5">
                  {labels.map(label => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => handleToggleLabel(label.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedLabels.includes(label.id) ? 'ring-2 ring-white/30 scale-105' : 'opacity-50 hover:opacity-75'
                      }`}
                      style={{
                        backgroundColor: `${label.color}20`,
                        color: label.color,
                      }}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>

                {/* New Label Form */}
                {showNewLabel ? (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder={t("标签名称")}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {labelColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLabelColor(color)}
                          className={`w-7 h-7 rounded-lg transition-all ${
                            newLabelColor === color ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateLabel}
                        className="px-4 py-1.5 bg-[#7C3AED] rounded-lg text-sm text-white hover:bg-[#6D28D9] transition-colors"
                      >
                        {t('创建')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewLabel(false)}
                        className="px-4 py-1.5 bg-white/5 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
                      >
                        {t('取消')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewLabel(true)}
                    className="text-xs text-[#7C3AED] hover:text-[#8B5CF6] transition-colors flex items-center gap-1"
                  >
                    <Icon name="plus" size={12} />
                    {t('新建标签')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              {t('子任务')}
              {checklists.length > 0 && (
                <span className="ml-2 text-xs text-white/40">
                  ({checklists.filter(c => c.completed).length}/{checklists.length})
                </span>
              )}
            </label>

            {/* Checklist Items */}
            {checklists.length > 0 && (
              <div className="space-y-1.5 mb-3 bg-white/5 rounded-xl p-3">
                {checklists.map((item: ChecklistItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 group py-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(item.id, !item.completed)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        item.completed
                          ? 'bg-[#22C55E] border-[#22C55E]'
                          : 'border-white/20 hover:border-[#7C3AED]'
                      }`}
                    >
                      {item.completed && (
                        <Icon name="check" size={12} className="text-white" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm transition-all ${
                      item.completed ? 'text-white/40 line-through' : 'text-white'
                    }`}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklist(item.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-[#EF4444] transition-all"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Checklist Item */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                placeholder={t("添加子任务...")}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                disabled={!newChecklistText.trim()}
                className="px-4 py-2 bg-[#7C3AED]/20 border border-[#7C3AED]/30 rounded-lg text-sm text-[#7C3AED] hover:bg-[#7C3AED]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('添加')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-white/10 bg-[#0D0F1A]/80">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            {t('取消')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-lg shadow-[#7C3AED]/25"
          >
            {t('保存更改')}
          </button>
        </div>
      </div>

      {/* Custom DatePicker Styles */}
      <style>{`
        .kanban-datepicker-popper {
          z-index: 100 !important;
        }
        .react-datepicker {
          background: rgba(13, 15, 26, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px);
          font-family: 'DM Sans', sans-serif !important;
        }
        .react-datepicker__header {
          background: rgba(124, 58, 237, 0.1) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px 12px 0 0 !important;
        }
        .react-datepicker__current-month {
          color: #FAF5FF !important;
          font-weight: 600 !important;
          padding: 8px 0 !important;
        }
        .react-datepicker__day-name {
          color: rgba(250, 245, 255, 0.5) !important;
          width: 32px !important;
          line-height: 32px !important;
        }
        .react-datepicker__day {
          color: rgba(250, 245, 255, 0.8) !important;
          width: 32px !important;
          line-height: 32px !important;
          border-radius: 8px !important;
          margin: 2px !important;
        }
        .react-datepicker__day:hover {
          background: rgba(124, 58, 237, 0.3) !important;
          color: #fff !important;
        }
        .react-datepicker__day--selected {
          background: #7C3AED !important;
          color: #fff !important;
        }
        .react-datepicker__day--keyboard-selected {
          background: rgba(124, 58, 237, 0.3) !important;
        }
        .react-datepicker__day--today {
          border: 1px solid #7C3AED !important;
        }
        .react-datepicker__navigation-icon::before {
          border-color: #FAF5FF !important;
        }
        .react-datepicker__navigation {
          top: 12px !important;
        }
        .react-datepicker__navigation:hover *::before {
          border-color: #7C3AED !important;
        }
      `}</style>
    </div>
  );
}

export default CardEditor;

import { useState, useEffect, useRef } from 'react';
import { Priority } from '../../../bindings/ltools/plugins/kanban/models';
import { t } from '@/i18n';

interface AddCardDialogProps {
  isOpen: boolean;
  onConfirm: (title: string, priority: Priority) => void;
  onCancel: () => void;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: Priority.PriorityHigh, label: t('高优先级'), color: '#EF4444' },
  { value: Priority.PriorityMedium, label: t('中优先级'), color: '#F59E0B' },
  { value: Priority.PriorityLow, label: t('低优先级'), color: '#22C55E' },
];

export function AddCardDialog({
  isOpen,
  onConfirm,
  onCancel,
}: AddCardDialogProps): JSX.Element | null {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.PriorityMedium);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPriority(Priority.PriorityMedium);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onConfirm(title, priority);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative glass-heavy rounded-xl p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold text-white mb-4">{t('添加卡片')}</h3>

        <form onSubmit={handleSubmit}>
          {/* Title Input */}
          <div className="mb-4">
            <label className="block text-sm text-white/60 mb-2">{t('卡片标题')}</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("请输入卡片标题")}
              className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED] transition-colors"
            />
          </div>

          {/* Priority Selection */}
          <div className="mb-6">
            <label className="block text-sm text-white/60 mb-2">{t('优先级')}</label>
            <div className="flex gap-2">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                    priority === option.value
                      ? 'border-current'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                  style={{
                    borderColor: priority === option.value ? option.color : undefined,
                    backgroundColor: priority === option.value ? `${option.color}20` : 'transparent',
                    color: priority === option.value ? option.color : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            >
              {t('取消')}
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('添加')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCardDialog;

import { useState, useEffect, useRef } from 'react';
import { Priority } from '../../../bindings/ltools/plugins/kanban/models';
import { Button, Input, Modal } from '../ui';

interface AddCardDialogProps {
  isOpen: boolean;
  onConfirm: (title: string, priority: Priority) => void;
  onCancel: () => void;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: Priority.PriorityHigh, label: '高优先级', color: 'var(--color-error-text)' },
  { value: Priority.PriorityMedium, label: '中优先级', color: 'var(--color-warning-text)' },
  { value: Priority.PriorityLow, label: '低优先级', color: 'var(--color-success-text)' },
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

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title="添加卡片"
      width={380}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" type="submit" form="kanban-add-card-form" disabled={!title.trim()}>
            添加
          </Button>
        </>
      }
    >
      <form id="kanban-add-card-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="field-label">卡片标题</label>
          <Input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入卡片标题"
          />
        </div>

        {/* Priority Selection */}
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
                  className="flex-1 rounded-[6px] border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150"
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
      </form>
    </Modal>
  );
}

export default AddCardDialog;

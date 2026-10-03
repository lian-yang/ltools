import { useEffect } from 'react';
import { Icon } from './Icon';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const toastVisuals: Record<ToastType, { icon: Parameters<typeof Icon>[0]['name']; color: string }> = {
  success: { icon: 'check-circle', color: 'var(--color-success-text)' },
  error: { icon: 'x-circle', color: 'var(--color-error-text)' },
  warning: { icon: 'exclamation-circle', color: 'var(--color-warning-text)' },
  info: { icon: 'information-circle', color: 'var(--color-info)' },
};

function ToastItem({ toast, onRemove }: ToastItemProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const { icon, color } = toastVisuals[toast.type] ?? toastVisuals.info;

  return (
    <div
      className="animate-slide-up flex w-[300px] items-start gap-2.5 rounded-[10px] px-3.5 py-3"
      style={{
        background: 'var(--color-surface-3)',
        border: '1px solid var(--color-hairline-strong)',
        boxShadow: 'var(--shadow-pop)',
      }}
      role="alert"
    >
      <Icon name={icon} size={16} color={color} className="mt-px shrink-0" />
      <p className="flex-1 text-[12.5px] leading-relaxed text-text-1 select-text">{toast.message}</p>
      <button
        className="icon-btn icon-btn-sm -mr-1 -mt-1 shrink-0"
        onClick={() => onRemove(toast.id)}
        aria-label="关闭"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps): JSX.Element | null {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[900] flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

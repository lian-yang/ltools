import { useEffect } from 'react';
import { Icon } from './Icon';
import { t } from '@/i18n';
import { tAuto } from '@/i18n';

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

function ToastItem({ toast, onRemove }: ToastItemProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]';
      case 'error':
        return 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]';
      case 'warning':
        return 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]';
      case 'info':
      default:
        return 'bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#60A5FA]';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'exclamation-circle';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  return (
    <div
      className={`glass-light rounded-lg p-4 flex items-center gap-3 border ${getStyles()} animate-slide-in-right min-w-[300px] max-w-md`}
      role="alert"
    >
      <Icon name={getIcon()} size={20} />
      <p className="flex-1 text-sm text-white/90">{tAuto(toast.message)}</p>
      <button
        className="p-1 rounded hover:bg-white/5 transition-colors clickable"
        onClick={() => onRemove(toast.id)}
        aria-label={t("关闭")}
      >
        <Icon name="x-circle" size={16} />
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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

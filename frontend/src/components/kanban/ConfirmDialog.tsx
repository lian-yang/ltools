
import { t } from '@/i18n';interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative glass-heavy rounded-xl p-6 w-80 max-w-[90vw]">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/60 mb-6">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
          >
            {t('取消')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors"
          >
            {t('删除')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

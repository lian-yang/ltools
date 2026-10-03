import { Button, Modal } from '../ui';

interface ConfirmDialogProps {
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
  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title={title}
      width={340}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger-solid" onClick={onConfirm}>
            删除
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-text-2">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;

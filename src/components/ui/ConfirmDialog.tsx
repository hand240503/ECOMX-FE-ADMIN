import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, type ButtonVariant } from './Button';
import { cn } from '../../lib/cn';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: Extract<ButtonVariant, 'danger' | 'profilePrimary'>;
  confirmLoading?: boolean;
  className?: string;
};

const portalTarget = typeof document !== 'undefined' ? document.body : null;

/**
 * Hộp thoại xác nhận tùy biến (thay `window.confirm` / alert hệ thống).
 * Render qua portal ra `body` để luôn nổi trên cùng.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'profilePrimary',
  confirmLoading = false,
  className
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmLoading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, confirmLoading]);

  if (!open || !portalTarget) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[400] flex items-center justify-center bg-background/80 p-4 backdrop-blur-[2px]',
        className
      )}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={confirmLoading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-lg tablet:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="m-0 text-heading text-text-primary">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mb-0 mt-3 text-body leading-relaxed text-text-secondary">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-sm sm:w-auto"
            onClick={onCancel}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            className="w-full rounded-sm sm:w-auto"
            loading={confirmLoading}
            disabled={confirmLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

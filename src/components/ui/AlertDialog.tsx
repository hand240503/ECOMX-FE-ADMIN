import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export type AlertDialogVariant = 'error' | 'warning' | 'info';

export type AlertDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** Nhãn nút đóng (mặc định: "Đã hiểu") */
  actionLabel?: string;
  onClose: () => void;
  /** Kiểu hiển thị — ảnh hưởng icon + viền */
  variant?: AlertDialogVariant;
  className?: string;
};

const portalTarget = typeof document !== 'undefined' ? document.body : null;

const variantStyles: Record<AlertDialogVariant, string> = {
  error: 'border-l-4 border-l-danger',
  warning: 'border-l-4 border-l-amber-500',
  info: 'border-l-4 border-l-[#1a94ff]',
};

/**
 * Hộp thoại một nút — hiển thị phản hồi (lỗi / cảnh báo / thông tin) thay cho toast khi cần nhấn mạnh.
 * Render qua portal; role="alertdialog" để trình đọc màn hình nhận ra là alert modal.
 */
export function AlertDialog({
  open,
  title,
  message,
  actionLabel = 'Đã hiểu',
  onClose,
  variant = 'error',
  className,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !portalTarget) return null;

  const Icon = variant === 'info' ? Info : AlertTriangle;
  const iconWrap =
    variant === 'error'
      ? 'bg-red-50 text-danger'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-[#1a94ff]';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[410] flex items-center justify-center bg-background/80 p-4 backdrop-blur-[2px]',
        className
      )}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-desc"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-lg tablet:p-6',
          variantStyles[variant]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
              iconWrap
            )}
            aria-hidden
          >
            <Icon />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="alert-dialog-title" className="m-0 text-heading text-text-primary">
              {title}
            </h2>
            <p id="alert-dialog-desc" className="mb-0 mt-3 whitespace-pre-wrap text-body leading-relaxed text-text-secondary">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="profilePrimary" className="rounded-sm px-6" onClick={onClose}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export type AddFormShellPresentation = 'inline' | 'modal';

export type AddFormShellProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer (action buttons) — render bên trong shell */
  footer?: ReactNode;
  /**
   * `inline` (mặc định): form xếp trong luồng trang, slide-down — PRICING-UI.md §8.3.
   * `modal`: overlay căn giữa, nền mờ, hiệu ứng nổi lên (dialog).
   */
  presentation?: AddFormShellPresentation;
};

/**
 * Collapsible add form shell — match PRICING-UI.md §8.3 (inline).
 * Modal variant: backdrop + centered panel for CRUD dialogs.
 */
export function AddFormShell({
  open,
  title,
  onClose,
  children,
  footer,
  presentation = 'inline',
}: AddFormShellProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || presentation !== 'modal') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, presentation]);

  useEffect(() => {
    if (!open || presentation !== 'modal') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, presentation, onClose]);

  if (!open) return null;

  const panelClasses =
    presentation === 'modal'
      ? clsx(
          'w-full max-w-4xl rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5 sm:p-6',
          'shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out',
          'animate-[fadeSlideUpModal_220ms_ease-out]'
        )
      : clsx(
          'rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4',
          'shadow-[var(--card-shadow)] transition-all duration-200 ease-out',
          'animate-[fadeSlideDown_180ms_ease-out]'
        );

  const inner = (
    <div className={panelClasses}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            'rounded-md border border-[var(--bg-border)] p-1.5 text-[var(--text-secondary)]',
            'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
          )}
          aria-label="Đóng biểu mẫu"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3">{children}</div>
      {footer ? <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--bg-border)] pt-3">{footer}</div> : null}
    </div>
  );

  if (presentation === 'modal') {
    return (
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px] animate-[fadeSlideDown_200ms_ease-out]"
          onClick={onClose}
          aria-label="Đóng lớp nền"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-4xl overflow-y-auto overscroll-contain"
        >
          {inner}
        </div>
      </div>
    );
  }

  return inner;
}

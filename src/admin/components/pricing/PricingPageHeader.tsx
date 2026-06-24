import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Plus, X } from 'lucide-react';

export type PricingPageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Nếu truyền cta thì hiển thị nút "Tạo …" — khớp spec §3 */
  cta?: {
    label: string;
    onClick: () => void;
    /** Khi đang mở form, đổi nút thành Đóng — match spec §8.3 (toggle) */
    open?: boolean;
    disabled?: boolean;
  };
  /** Phần tử phụ bên phải (vd nút Xuất Excel), hiển thị trước nút cta. */
  extra?: ReactNode;
};

export function PricingPageHeader({ title, subtitle, cta, extra }: PricingPageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-admin-heading)] text-[15px] font-medium text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        {(extra || cta) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {extra}
            {cta ? (
              <button
                type="button"
                onClick={cta.onClick}
                disabled={cta.disabled}
                className={clsx(
                  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  cta.open
                    ? 'border border-[var(--bg-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    : 'bg-[var(--accent)] text-white hover:brightness-110'
                )}
              >
                {cta.open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {cta.open ? 'Đóng' : cta.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

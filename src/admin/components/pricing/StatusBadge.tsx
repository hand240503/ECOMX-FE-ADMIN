import { clsx } from 'clsx';

/** Trạng thái bản ghi API (1 / 0) — đồng bộ bảng và form quản trị */
export const ADMIN_RECORD_STATUS_LABEL_VI = {
  active: 'Hoạt động',
  inactive: 'Ngưng hoạt động',
} as const;

export type StatusBadgeTone = 'success' | 'info' | 'warning' | 'neutral' | 'danger';

const styles: Record<StatusBadgeTone, string> = {
  success: 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]',
  info: 'border-[var(--info)]/40 bg-[var(--info)]/10 text-[var(--info)]',
  warning: 'border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]',
  neutral: 'border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  danger: 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]',
};

export function StatusBadge({ tone, label }: { tone: StatusBadgeTone; label: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        styles[tone]
      )}
    >
      <span
        className={clsx(
          'size-1.5 rounded-full',
          tone === 'success' && 'bg-[var(--success)]',
          tone === 'info' && 'bg-[var(--info)]',
          tone === 'warning' && 'bg-[var(--warning)]',
          tone === 'neutral' && 'bg-[var(--text-muted)]',
          tone === 'danger' && 'bg-[var(--danger)]'
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type StatBoxProps = {
  label: string;
  value: ReactNode;
  /** Tone màu khung — match spec §6.2 (border-left tier) */
  tone?: 'default' | 'success' | 'warning' | 'info' | 'danger' | 'muted';
  /** Hiển thị border-left dày — dùng cho tier card */
  accent?: boolean;
  className?: string;
};

const toneBorder: Record<NonNullable<StatBoxProps['tone']>, string> = {
  default: 'border-[var(--bg-border)]',
  success: 'border-[var(--success)]',
  warning: 'border-[var(--warning)]',
  info: 'border-[var(--info)]',
  danger: 'border-[var(--danger)]',
  muted: 'border-[var(--bg-border)] opacity-70',
};

export function StatBox({ label, value, tone = 'default', accent = false, className }: StatBoxProps) {
  return (
    <div
      className={clsx(
        'rounded-md border bg-[var(--bg-base)] px-3 py-2',
        accent ? `border-l-2 ${toneBorder[tone]} border-[var(--bg-border)]` : toneBorder[tone],
        accent ? 'border' : 'border',
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-admin-mono)] text-[13px] font-medium text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

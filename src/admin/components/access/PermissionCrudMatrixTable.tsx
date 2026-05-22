import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { PermissionMatrixRow } from '../../../lib/permissionCatalog';
import { CRUD_COLUMN_LABEL, CRUD_COLUMN_ORDER } from '../../../lib/permissionCatalog';

const CRUD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  create: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/60' },
  read:   { bg: 'bg-sky-50 dark:bg-sky-950/30',     text: 'text-sky-700 dark:text-sky-400',     border: 'border-sky-200 dark:border-sky-800/60' },
  update: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/60' },
  delete: { bg: 'bg-rose-50 dark:bg-rose-950/30',   text: 'text-rose-700 dark:text-rose-400',   border: 'border-rose-200 dark:border-rose-800/60' },
};

function cellTitle(entries: { code: number; label: string }[]): string {
  if (entries.length === 0) return '';
  return entries.map((e) => `${e.code}: ${e.label}`).join('\n');
}

type Props = {
  rows: PermissionMatrixRow[];
  variant?: 'full' | 'compact';
};

export function PermissionCrudMatrixTable({ rows, variant = 'full' }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Không có dữ liệu ma trận.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]">
              <th
                className={clsx(
                  'px-4 py-3 text-left text-xs font-semibold tracking-wide text-[var(--text-secondary)]',
                  variant === 'compact' ? 'min-w-[100px] max-w-[180px]' : 'min-w-[160px]'
                )}
              >
                Phân hệ
              </th>
              {CRUD_COLUMN_ORDER.map((key) => {
                const c = CRUD_COLORS[key] ?? CRUD_COLORS.create!;
                return (
                  <th
                    key={key}
                    className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-[var(--text-secondary)]"
                  >
                    <span
                      className={clsx(
                        'inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold border',
                        c.bg, c.text, c.border
                      )}
                    >
                      {CRUD_COLUMN_LABEL[key]}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bg-border)]/60">
            {rows.map((row, i) => (
              <tr
                key={row.moduleKey}
                className={clsx(
                  'transition-colors hover:bg-[var(--bg-elevated)]/40',
                  i % 2 === 1 && 'bg-[var(--bg-elevated)]/20'
                )}
              >
                <td
                  className="px-4 py-3"
                  title={
                    row.other.length
                      ? `Quyền bổ sung: ${row.other.map((o) => `${o.code} (${o.label})`).join('; ')}`
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-0.5 rounded-full bg-[var(--accent)]" aria-hidden />
                    <span className="font-medium leading-snug text-[var(--text-primary)]">
                      {row.moduleLabel}
                    </span>
                    {row.other.length > 0 ? (
                      <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        +{row.other.length}
                      </span>
                    ) : null}
                  </div>
                </td>
                {CRUD_COLUMN_ORDER.map((key) => {
                  const entries = row.columns[key];
                  const has = entries.length > 0;
                  const c = CRUD_COLORS[key] ?? CRUD_COLORS.create!;
                  return (
                    <td
                      key={key}
                      className="px-3 py-3 text-center align-middle"
                      title={cellTitle(entries)}
                    >
                      {has ? (
                        <span
                          className={clsx(
                            'inline-flex size-8 items-center justify-center rounded-full border',
                            c.bg, c.text, c.border
                          )}
                          aria-label={`Đã có quyền (${entries.length})`}
                        >
                          <Check className="size-[14px]" strokeWidth={2.5} aria-hidden />
                        </span>
                      ) : (
                        <span
                          className="inline-flex size-8 items-center justify-center rounded-full border border-dashed border-[var(--bg-border)] text-[var(--text-muted)]"
                          aria-label="Chưa có quyền"
                        >
                          <span className="size-1.5 rounded-full bg-current opacity-30" aria-hidden />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

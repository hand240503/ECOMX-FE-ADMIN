import { clsx } from 'clsx';

export default function AdminPlaceholderPage({
  title,
  description,
  badge,
}: {
  title: string;
  /** Mô tả ngắn tùy chọn — không hiển thị khi bỏ trống */
  description?: string;
  badge?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <span
            className={clsx(
              'rounded-md border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2.5 py-1',
              'text-[11px] font-bold uppercase tracking-wide text-[var(--warning)]'
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div
        className={clsx(
          'rounded-xl border border-dashed border-[var(--bg-border)] bg-[var(--bg-surface)] p-8',
          'text-sm text-[var(--text-muted)]'
        )}
      >
        Nội dung trang sẽ được bổ sung sau.
      </div>
    </div>
  );
}

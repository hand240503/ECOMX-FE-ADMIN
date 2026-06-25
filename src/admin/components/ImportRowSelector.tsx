import { clsx } from 'clsx';
import { CheckSquare, Square, ListChecks } from 'lucide-react';
import type { ParsedGrid } from '../../utils/excelRows';

type Props = {
  grid: ParsedGrid;
  /** Tập chỉ số dòng (trong grid.rows) đang được chọn. */
  selected: Set<number>;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  /** Ghi chú tùy chọn hiển thị phía trên bảng. */
  note?: string;
};

/**
 * Bảng chọn dòng dùng chung cho mọi luồng nhập Excel:
 * mỗi dòng có ô tích chọn (mặc định chọn tất cả), kèm nút "Chọn tất cả" / "Bỏ chọn tất cả".
 * Chỉ những dòng được tích mới được nhập / cập nhật.
 */
export function ImportRowSelector({ grid, selected, onToggle, onSelectAll, onClearAll, note }: Props) {
  const total = grid.rows.length;
  const count = selected.size;
  const allSelected = count === total && total > 0;

  // Ẩn cột "id" nội bộ khỏi bảng xem trước (giữ product_id). Chỉ ảnh hưởng hiển thị, không đổi file gửi lên.
  const visibleCols = grid.headers
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ header }) => (header ?? '').trim().toLowerCase() !== 'id');

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <ListChecks className="size-4 text-[var(--accent)]" />
          Đã chọn <b className="text-[var(--text-primary)]">{count}</b> / {total} dòng
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--bg-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-40"
          >
            <CheckSquare className="size-3.5" /> Chọn tất cả
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={count === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--bg-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-40"
          >
            <Square className="size-3.5" /> Bỏ chọn tất cả
          </button>
        </div>
      </div>

      {note && <p className="text-xs leading-relaxed text-[var(--text-muted)]">{note}</p>}

      <div className="overflow-hidden rounded-xl border border-[var(--bg-border)]">
        <div className="max-h-[22rem] overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--bg-elevated)]/95 text-xs text-[var(--text-muted)] backdrop-blur">
              <tr>
                <th className="w-10 px-3 py-2 text-center font-medium">
                  <button
                    type="button"
                    onClick={allSelected ? onClearAll : onSelectAll}
                    className="inline-flex text-[var(--accent)]"
                    aria-label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  >
                    {allSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                  </button>
                </th>
                <th className="w-12 px-2 py-2 font-medium">#</th>
                {visibleCols.map(({ header, index }) => (
                  <th key={index} className="whitespace-nowrap px-3 py-2 font-medium">
                    {header || `Cột ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row, idx) => {
                const isOn = selected.has(idx);
                return (
                  <tr
                    key={idx}
                    onClick={() => onToggle(idx)}
                    className={clsx(
                      'cursor-pointer border-t border-[var(--bg-border)]/60 transition-colors',
                      isOn ? 'hover:bg-[var(--accent)]/5' : 'bg-[var(--bg-elevated)]/40 opacity-55 hover:opacity-80'
                    )}
                  >
                    <td className="px-3 py-2 text-center">
                      <span className={clsx('inline-flex', isOn ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')}>
                        {isOn ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                    {visibleCols.map(({ index }) => (
                      <td key={index} className="max-w-[16rem] truncate px-3 py-2 text-[var(--text-primary)]">
                        {row[index] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {grid.rows.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length + 2} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    File không có dòng dữ liệu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

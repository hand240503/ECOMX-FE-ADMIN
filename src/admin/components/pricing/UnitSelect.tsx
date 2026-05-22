import { forwardRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { adminUnitService } from '../../../api/services/adminUnitService';
import type { UnitResponse } from '../../../api/types/unit.types';

export type UnitSelectProps = {
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  /** Hiện tùy chọn placeholder (id=0) khi chưa chọn */
  placeholder?: string;
  /** Field name nếu đăng ký với react-hook-form */
  name?: string;
  id?: string;
  /** Chỉ hiển thị unit có status >= 1 (active). Default: true */
  onlyActive?: boolean;
};

/**
 * Select đơn vị tính, share cache `admin-units` cho mọi form giá.
 * @see docs/ADMIN_UNITS.md
 */
export const UnitSelect = forwardRef<HTMLSelectElement, UnitSelectProps>(function UnitSelect(
  { value, onChange, className, disabled, placeholder, name, id, onlyActive = true },
  ref
) {
  const unitsQuery = useQuery({
    queryKey: ['admin-units'],
    queryFn: ({ signal }) => adminUnitService.list(signal),
    staleTime: 5 * 60_000,
  });

  const items = useMemo(() => {
    const all: UnitResponse[] = unitsQuery.data ?? [];
    return onlyActive ? all.filter((u) => u.status === 1) : all;
  }, [unitsQuery.data, onlyActive]);

  const selectableIds = useMemo(
    () => items.map((u) => u.id).filter((id) => Number.isFinite(id) && id > 0),
    [items]
  );
  const selectableIdsKey = selectableIds.slice().sort((a, b) => a - b).join(',');
  const firstSelectableId = selectableIds[0];

  useEffect(() => {
    if (unitsQuery.isLoading || selectableIds.length === 0 || firstSelectableId === undefined) return;
    const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
    const allowed = new Set(selectableIds);
    const ok = Number.isFinite(n) && n > 0 && allowed.has(n);
    if (!ok) {
      onChange(firstSelectableId);
    }
    // Đồng bộ với GET /admin/units — tránh cứng id=1 trong form khi DB chỉ có unit khác.
  }, [unitsQuery.isLoading, selectableIdsKey, selectableIds.length, firstSelectableId, value, onChange]);

  const baseCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

  const numericValue = Number(value);

  return (
    <select
      ref={ref}
      id={id}
      name={name}
      value={Number.isFinite(numericValue) ? String(numericValue) : ''}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled || unitsQuery.isLoading}
      className={clsx(baseCls, className)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {unitsQuery.isLoading ? (
        <option value="">Đang tải đơn vị…</option>
      ) : items.length === 0 ? (
        <option value="">Chưa có đơn vị — thêm đơn vị trong phần định giá</option>
      ) : (
        items.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name_unit}
            {u.ratio !== 1 ? ` (×${u.ratio})` : ''}
          </option>
        ))
      )}
    </select>
  );
});

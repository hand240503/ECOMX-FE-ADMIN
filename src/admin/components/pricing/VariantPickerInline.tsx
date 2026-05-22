import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { adminProductService } from '../../../api/services/adminProductService';
import { formatVariantPickLabel } from '../../../lib/formatVariantLabel';

export type VariantPickerInlineProps = {
  productId: number | null | undefined;
  value: number | null | undefined;
  onChange: (variantId: number | null) => void;
  disabled?: boolean;
  required?: boolean;
  /** Chọn cố định nếu sản phẩm chỉ có một phân loại. */
  autoPickSingleVariant?: boolean;
};

export function VariantPickerInline({
  productId,
  value,
  onChange,
  disabled,
  required,
  autoPickSingleVariant,
}: VariantPickerInlineProps) {
  const pid = productId != null && productId > 0 ? productId : null;

  const productQuery = useQuery({
    queryKey: ['admin-product', pid],
    queryFn: ({ signal }) => adminProductService.getById(pid as number, signal),
    enabled: pid != null,
    staleTime: 30_000,
  });

  const variants = useMemo(() => {
    const rows = productQuery.data?.variants ?? [];
    return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }, [productQuery.data?.variants]);

  useEffect(() => {
    if (!autoPickSingleVariant || disabled || variants.length !== 1) return;
    const only = variants[0]?.id;
    if (only == null || !(only > 0)) return;
    if (value == null || value === 0 || !Number.isFinite(Number(value))) {
      onChange(only);
    }
  }, [autoPickSingleVariant, disabled, onChange, value, variants]);

  const invalidSelection =
    variants.length > 0 && value != null && value > 0 && !variants.some((x) => x.id === value);

  const selectCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

  if (pid == null) {
    return (
      <select disabled className={clsx(selectCls, 'text-[var(--text-muted)]')}>
        <option>Chọn sản phẩm trước…</option>
      </select>
    );
  }

  if (productQuery.isLoading) {
    return (
      <select disabled className={selectCls}>
        <option>Đang tải phân loại…</option>
      </select>
    );
  }

  if (productQuery.isError) {
    return (
      <p className="text-xs text-[var(--danger)]">
        Không tải được sản phẩm để hiển thị phân loại.
      </p>
    );
  }

  if (variants.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--warning)]/50 bg-[var(--warning)]/10 px-2 py-2 text-xs text-[var(--warning)]">
        Sản phẩm chưa có phân loại (SKU). Hãy tạo ít nhất một biến thể trong màn sản phẩm.
      </p>
    );
  }

  const vNum = typeof value === 'number' ? value : value != null ? Number(value) : 0;

  return (
    <div className="space-y-1">
      <select
        aria-label="Chọn phân loại SKU"
        className={clsx(selectCls, invalidSelection && 'border-[var(--danger)]')}
        disabled={disabled}
        value={vNum > 0 ? String(vNum) : ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
      >
        <option value="">{required ? '— Chọn phân loại —' : '(không)'}</option>
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            {formatVariantPickLabel(v)}
            {!v.active ? ' · (tắt)' : ''}
          </option>
        ))}
      </select>
      {invalidSelection ? (
        <p className="text-[10px] text-[var(--danger)]">
          Phân loại #{value} không thuộc sản phẩm này — chọn lại.
        </p>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)]">
          Số trong ngoặc là mã phân loại dùng để đối chiếu với đơn hàng.
        </p>
      )}
      {required && vNum <= 0 ? (
        <input className="sr-only" required tabIndex={-1} aria-hidden value="" onChange={() => undefined} />
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronDown, Search, X } from 'lucide-react';
import { adminProductService } from '../../../api/services/adminProductService';
import type { ProductFullResponse } from '../../../api/types/product.types';
import { formatProductListPriceLabel } from '../../../lib/formatPrice';

export type ProductPickerInlineProps = {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Loại trừ id (vd: anchor != companion). */
  excludeIds?: number[];
};

async function fetchAllAdminProducts(signal: AbortSignal): Promise<ProductFullResponse[]> {
  const limit = 100;
  const maxPages = 500;
  let page = 0;
  const acc: ProductFullResponse[] = [];
  while (page < maxPages) {
    const { products, metadata } = await adminProductService.list({ page, limit, signal });
    acc.push(...products);
    if (products.length === 0) break;
    const totalPages = metadata?.totalPages;
    if (totalPages != null && page + 1 >= totalPages) break;
    if (metadata?.last === true) break;
    if (metadata?.hasNext === false) break;
    if (products.length < limit) break;
    page += 1;
  }
  return acc;
}

/**
 * Combobox tìm/chọn 1 sản phẩm — dùng cho form Time Change / Volume / PwP.
 * Cache theo key chung 'admin-products-pricing-pool' để các trang share data.
 */
export function ProductPickerInline({
  value,
  onChange,
  placeholder = 'Tìm sản phẩm theo tên / SKU / ID…',
  required,
  disabled,
  excludeIds,
}: ProductPickerInlineProps) {
  const listQuery = useQuery({
    queryKey: ['admin-products-pricing-pool'],
    queryFn: ({ signal }) => fetchAllAdminProducts(signal),
    staleTime: 60_000,
  });

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const all = listQuery.data ?? [];
  const selected = useMemo(() => all.find((p) => p.id === value) ?? null, [all, value]);

  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds ?? []);
    const q = filter.trim().toLowerCase();
    const base = all.filter((p) => !exclude.has(p.id));
    if (!q) return base.slice(0, 100);
    return base
      .filter((p) => {
        if (String(p.id).includes(q)) return true;
        if (p.sku != null && String(p.sku).toLowerCase().includes(q)) return true;
        if (p.productName.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice(0, 100);
  }, [all, excludeIds, filter]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={clsx(
          'flex w-full items-center gap-2 rounded-lg border bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm',
          'border-[var(--bg-border)] text-[var(--text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      >
        <Search className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <span className={clsx('flex-1 truncate', !selected && 'text-[var(--text-muted)]')}>
          {selected ? `${selected.productName} · SKU ${selected.sku ?? selected.id}` : placeholder}
        </span>
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="rounded-md p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--danger)]"
            aria-label="Bỏ chọn"
          >
            <X className="size-3.5" />
          </span>
        ) : null}
        <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
      </button>
      {required && value == null ? (
        <input className="sr-only" required tabIndex={-1} aria-hidden value="" onChange={() => undefined} />
      ) : null}

      {open ? (
        <div
          className={clsx(
            'absolute left-0 right-0 z-20 mt-1 max-h-[320px] overflow-hidden',
            'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--dropdown-shadow)]'
          )}
        >
          <div className="border-b border-[var(--bg-border)] p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Lọc theo tên, SKU hoặc ID…"
              className={clsx(
                'w-full rounded-md border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm',
                'text-[var(--text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
            />
          </div>
          <div className="max-h-[260px] overflow-auto">
            {listQuery.isLoading ? (
              <div className="px-3 py-4 text-sm text-[var(--text-muted)]">Đang tải…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--text-muted)]">Không tìm thấy sản phẩm.</div>
            ) : (
              <ul>
                {filtered.map((p) => {
                  const active = p.id === value;
                  const priceLine = formatProductListPriceLabel(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(p.id);
                          setOpen(false);
                          setFilter('');
                        }}
                        className={clsx(
                          'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                          active
                            ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.productName}</p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            ID {p.id} · SKU {p.sku ?? '—'}
                          </p>
                        </div>
                        {priceLine !== '—' ? (
                          <span className="shrink-0 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-secondary)]">
                            {priceLine}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Loader2, Package, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { adminProductService } from '../../api/services/adminProductService';
import { adminUnitService } from '../../api/services/adminUnitService';
import { categoryService } from '../../api/services/categoryService';
import type { ProductFullResponse, ProductPrice, ProductPriceUpsertRequest } from '../../api/types/product.types';
import { formatPrice } from '../../lib/formatPrice';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { UnitSelect } from '../components/pricing/UnitSelect';
import { VndIntegerInput } from '../components/pricing/VndIntegerInput';

type DraftPriceRow = {
  key: string;
  priceEntityId?: number;
  unitId: number;
  currentValue: number;
  referencePrice: number;
  productVariantId?: number | null;
  variantSkuLabel?: string | null;
  variantOptionValues?: Record<string, string> | null;
};

function variantFieldsFromPrice(pr: ProductPrice): Pick<DraftPriceRow, 'productVariantId' | 'variantSkuLabel' | 'variantOptionValues'> {
  const vidRaw = pr.productVariantId ?? pr.variant?.id;
  const productVariantId = vidRaw != null && Number(vidRaw) > 0 ? Number(vidRaw) : null;
  const sku = typeof pr.variant?.skuCode === 'string' ? pr.variant.skuCode.trim() : '';
  const variantSkuLabel = sku !== '' ? sku : productVariantId != null ? `ID ${productVariantId}` : null;
  const variantOptionValues = pr.variant?.optionValues ?? null;
  return { productVariantId, variantSkuLabel, variantOptionValues };
}

function rowsFromPrices(prices: ProductPrice[], defaultUnitId: number): DraftPriceRow[] {
  if (prices.length > 0) {
    return prices.map((pr) => ({
      key: `p-${pr.id}`,
      priceEntityId: pr.id,
      unitId: pr.unitId,
      currentValue: pr.currentValue,
      referencePrice: pr.oldValue ?? 0,
      ...variantFieldsFromPrice(pr),
    }));
  }
  return [{
    key: 'default-empty',
    unitId: defaultUnitId,
    currentValue: 0,
    referencePrice: 0,
    productVariantId: null,
    variantSkuLabel: null,
    variantOptionValues: null,
  }];
}

function emptyPriceDraftRow(
  defaultUnitId: number,
  opts?: { productVariantId?: number | null; variantSkuLabel?: string | null; variantOptionValues?: Record<string, string> | null }
): DraftPriceRow {
  return {
    key: `new-${Math.random().toString(36).slice(2)}`,
    unitId: defaultUnitId,
    currentValue: 0,
    referencePrice: 0,
    productVariantId: opts?.productVariantId ?? null,
    variantSkuLabel: opts?.variantSkuLabel ?? null,
    variantOptionValues: opts?.variantOptionValues ?? null,
  };
}

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

function ProductThumb({ product }: { product: ProductFullResponse }) {
  const url = product.thumbnailUrl ?? product.mainImageUrl ?? product.imageUrl ?? product.coverImageUrl ?? null;
  if (!url) {
    return (
      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
        <Package className="size-5" aria-hidden />
      </div>
    );
  }
  return (
    <div className="h-16 w-full overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

/** Chip hiển thị một cặp key–value từ optionValues */
function OptionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[11px]">
      <span className="text-[var(--text-muted)]">{label}:</span>
      <span className="font-semibold text-[var(--text-primary)]">{value}</span>
    </span>
  );
}

/** Dải thông tin variant gắn với một dòng giá */
function VariantBadge({ row }: { row: DraftPriceRow }) {
  if (row.productVariantId == null || row.productVariantId <= 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
        Giá SPU (không gắn phân loại)
      </span>
    );
  }

  const opts = row.variantOptionValues;
  const optPairs = opts ? Object.entries(opts) : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-[family-name:var(--font-admin-mono)] text-[11px] font-semibold text-[var(--accent)]">
        {row.variantSkuLabel ?? `ID ${row.productVariantId}`}
      </span>
      {optPairs.map(([k, v]) => (
        <OptionChip key={k} label={k} value={v} />
      ))}
    </div>
  );
}

export default function AdminProductCatalogPricesPage() {
  const queryClient = useQueryClient();
  const [searchRaw, setSearchRaw] = useState('');
  const [categoryId, setCategoryId] = useState<'all' | number>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-products-pricing-pool'],
    queryFn: ({ signal }) => fetchAllAdminProducts(signal),
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-pricing-categories'],
    queryFn: () => categoryService.getAll(),
    staleTime: 5 * 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-product', selectedId],
    queryFn: ({ signal }) => adminProductService.getById(selectedId as number, signal),
    enabled: selectedId != null,
  });

  const pricesQuery = useQuery({
    queryKey: ['admin-product-catalog-prices', selectedId],
    queryFn: ({ signal }) => adminProductService.listCatalogPrices(selectedId as number, signal),
    enabled: selectedId != null,
  });

  const unitsQuery = useQuery({
    queryKey: ['admin-units'],
    queryFn: ({ signal }) => adminUnitService.list(signal),
    staleTime: 5 * 60_000,
  });

  const preferredCatalogUnitId = useMemo(() => {
    const list = unitsQuery.data ?? [];
    const active = list.filter((u) => u.status === 1);
    const pick = active[0] ?? list[0];
    return pick != null ? pick.id : 0;
  }, [unitsQuery.data]);

  const [draft, setDraft] = useState<DraftPriceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DraftPriceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredProducts = useMemo(() => {
    const all = listQuery.data ?? [];
    const q = searchRaw.trim().toLowerCase();
    return all.filter((p) => {
      if (categoryId !== 'all' && (p.category?.id ?? -1) !== categoryId) return false;
      if (!q) return true;
      if (String(p.id).includes(q)) return true;
      if (p.sku != null && String(p.sku).toLowerCase().includes(q)) return true;
      if (p.productName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [listQuery.data, searchRaw, categoryId]);

  useEffect(() => {
    if (selectedId == null) { setDraft([]); return; }
    const rows = pricesQuery.data;
    if (!rows) return;
    setDraft(rowsFromPrices(rows, preferredCatalogUnitId));
  }, [selectedId, pricesQuery.data, preferredCatalogUnitId]);

  const addRow = useCallback(() => {
    const p = detailQuery.data;
    if (p == null) return;
    const vCount = p.variants?.length ?? 0;
    if (vCount > 1) {
      notify.error('Sản phẩm có nhiều phân loại. Thêm giá trong form chi tiết sản phẩm.');
      return;
    }
    const firstV = vCount === 1 ? p.variants![0] : null;
    setDraft((rows) => [
      ...rows,
      emptyPriceDraftRow(preferredCatalogUnitId, {
        productVariantId: firstV?.id ?? null,
        variantSkuLabel: firstV?.skuCode?.trim() || (firstV != null ? `ID ${firstV.id}` : null),
        variantOptionValues: firstV?.optionValues ?? null,
      }),
    ]);
  }, [preferredCatalogUnitId, detailQuery.data]);

  const removeRow = useCallback((key: string) => {
    setDraft((rows) => {
      const row = rows.find((x) => x.key === key);
      if (!row) return rows;
      if (rows.length <= 1) {
        notify.error('Cần giữ ít nhất 1 dòng giá.');
        return rows;
      }
      if (row.priceEntityId != null && row.priceEntityId > 0) {
        setDeleteTarget(row);
        return rows;
      }
      return rows.filter((r) => r.key !== key);
    });
  }, []);

  const updateRow = useCallback((key: string, patch: Partial<DraftPriceRow>) => {
    setDraft((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const closePanel = useCallback(() => setSelectedId(null), []);

  const onSave = useCallback(async () => {
    if (selectedId == null) return;
    const normalized = draft
      .map((r) => ({
        id: r.priceEntityId,
        unitId: Math.round(Number(r.unitId)),
        currentValue: Math.round(Number(r.currentValue)),
        oldValue: Math.round(Number(r.referencePrice) || 0),
        productVariantId:
          r.productVariantId != null && Number(r.productVariantId) > 0
            ? Math.round(Number(r.productVariantId))
            : null,
      }))
      .filter((r) => Number.isFinite(r.unitId) && r.unitId > 0);

    if (normalized.length === 0) { notify.error('Cần ít nhất một dòng giá hợp lệ.'); return; }
    for (const r of normalized) {
      if (!Number.isFinite(r.currentValue) || r.currentValue < 0) { notify.error('Giá bán không hợp lệ.'); return; }
      if (!Number.isFinite(r.oldValue) || r.oldValue < 0) { notify.error('Giá gốc không hợp lệ.'); return; }
    }

    setSaving(true);
    try {
      await Promise.all(
        normalized.map(async (r) => {
          const body: ProductPriceUpsertRequest = {
            unit_id: r.unitId,
            current_value: r.currentValue,
            old_value: r.oldValue,
          };
          if (r.productVariantId != null && r.productVariantId > 0) {
            body.product_variant_id = r.productVariantId;
          }
          if (r.id != null && r.id > 0) {
            return adminProductService.updateCatalogPrice(selectedId, r.id, body);
          }
          return adminProductService.createCatalogPrice(selectedId, body);
        })
      );
      notify.success('Đã lưu giá catalog');
      await queryClient.invalidateQueries({ queryKey: ['admin-product-catalog-prices', selectedId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-products-pricing-pool'] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không lưu được giá'));
    } finally {
      setSaving(false);
    }
  }, [draft, queryClient, selectedId]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget || selectedId == null || !deleteTarget.priceEntityId) return;
    setDeleting(true);
    try {
      await adminProductService.deleteCatalogPrice(selectedId, deleteTarget.priceEntityId);
      notify.success('Đã xóa dòng giá');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-product-catalog-prices', selectedId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-products-pricing-pool'] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không xóa được'));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, queryClient, selectedId]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const product = detailQuery.data;
  const panelLoading = selectedId != null && (detailQuery.isLoading || pricesQuery.isLoading);
  const categoryOptions = categoriesQuery.data ?? [];
  const hasMultiVariant = (product?.variants?.length ?? 0) > 1;

  return (
    <div className="space-y-5">
      <PricingPageHeader title="Giá niêm yết" />

      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm sản phẩm</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Tìm theo tên, SKU hoặc ID…"
            className={clsx(inputCls, 'w-full pl-9')}
            autoComplete="off"
          />
        </label>
        <select
          value={categoryId === 'all' ? 'all' : String(categoryId)}
          onChange={(e) => {
            const v = e.target.value;
            setCategoryId(v === 'all' ? 'all' : Number(v));
          }}
          className={clsx(inputCls, 'w-full sm:w-auto sm:min-w-[200px]')}
        >
          <option value="all">Tất cả danh mục</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Edit panel */}
      {selectedId != null && (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          {panelLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-[var(--text-secondary)]">
              <Loader2 className="size-4 animate-spin text-[var(--accent)]" aria-hidden />
              Đang tải…
            </div>
          ) : detailQuery.isError || pricesQuery.isError ? (
            <div className="p-6 text-sm text-[var(--danger)]">
              {getApiErrorMessage(detailQuery.error ?? pricesQuery.error, 'Không tải được dữ liệu.')}
            </div>
          ) : product ? (
            <>
              {/* Panel header */}
              <div className="flex items-start justify-between gap-3 border-b border-[var(--bg-border)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                    {(() => {
                      const url = product.thumbnailUrl ?? product.mainImageUrl ?? product.imageUrl ?? product.coverImageUrl ?? null;
                      return url
                        ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        : <div className="flex h-full items-center justify-center text-[var(--text-muted)]"><Package className="size-5" /></div>;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{product.productName}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      ID {product.id}
                      {product.sku ? ` · SKU ${product.sku}` : ''}
                      {product.category?.name ? ` · ${product.category.name}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  aria-label="Đóng"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Price rows */}
              <div className="space-y-2 p-5">
                {draft.map((row, i) => (
                  <div
                    key={row.key}
                    className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/30"
                  >
                    {/* Variant banner */}
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--bg-border)]/60 px-4 py-2.5">
                      <VariantBadge row={row} />
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">Dòng {i + 1}</span>
                    </div>

                    {/* Fields */}
                    <div className="grid items-end gap-3 p-4 sm:grid-cols-[160px_1fr_1fr_auto]">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-[var(--text-secondary)]">Đơn vị</label>
                        <UnitSelect
                          value={row.unitId}
                          onChange={(v) => updateRow(row.key, { unitId: v })}
                          className="py-1.5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-[var(--text-secondary)]">
                          Giá bán <span className="font-normal text-[var(--text-muted)]">(VNĐ)</span>
                        </label>
                        <VndIntegerInput
                          value={row.currentValue}
                          onChange={(n) => updateRow(row.key, { currentValue: n })}
                          className={clsx(inputCls, 'py-1.5')}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-[var(--text-secondary)]">
                          Giá gốc <span className="font-normal text-[var(--text-muted)]">(VNĐ · để 0 để ẩn)</span>
                        </label>
                        <VndIntegerInput
                          value={row.referencePrice}
                          onChange={(n) => updateRow(row.key, { referencePrice: n })}
                          className={clsx(inputCls, 'py-1.5')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={draft.length <= 1}
                        className={clsx(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--bg-border)]',
                          'text-[var(--danger)] hover:bg-[var(--bg-elevated)]',
                          'disabled:cursor-not-allowed disabled:opacity-30'
                        )}
                        aria-label="Xóa dòng giá"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Panel footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bg-border)] px-5 py-3">
                <button
                  type="button"
                  onClick={addRow}
                  disabled={saving || deleting || hasMultiVariant}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-sm font-semibold',
                    'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                    'disabled:cursor-not-allowed disabled:opacity-40'
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                  Thêm đơn vị
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || deleting}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white',
                      'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  >
                    {saving
                      ? <><Loader2 className="size-4 animate-spin" aria-hidden />Đang lưu…</>
                      : <><Save className="size-4" aria-hidden />Lưu</>
                    }
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Product grid */}
      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin text-[var(--accent)]" aria-hidden />
          Đang tải sản phẩm…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được danh sách.')}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] py-14 text-center text-sm text-[var(--text-muted)]">
          Không có sản phẩm khớp bộ lọc.
        </div>
      ) : (
        <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))' }}>
          {filteredProducts.map((p) => {
            const active = selectedId === p.id;
            const price = p.prices?.[0]?.currentValue;
            const oldPrice = p.prices?.[0]?.oldValue;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(active ? null : p.id)}
                  className={clsx(
                    'group flex w-full flex-col gap-2.5 rounded-xl border bg-[var(--bg-surface)] p-3 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    active
                      ? 'border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]'
                      : 'border-[var(--bg-border)] hover:border-[var(--accent)]/40 hover:shadow-sm'
                  )}
                >
                  <ProductThumb product={p} />
                  <div className="min-w-0 space-y-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--text-primary)]">
                      {p.productName}
                    </p>
                    {p.category?.name && (
                      <p className="truncate text-[10px] text-[var(--text-muted)]">{p.category.name}</p>
                    )}
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      {price != null ? (
                        <span className="font-[family-name:var(--font-admin-mono)] text-xs font-semibold text-[var(--accent)]">
                          {formatPrice(price)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">Chưa có giá</span>
                      )}
                      {oldPrice != null && oldPrice > 0 && (
                        <span className="font-[family-name:var(--font-admin-mono)] text-[10px] text-[var(--text-muted)] line-through">
                          {formatPrice(oldPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Xóa dòng giá?"
        message={
          deleteTarget?.variantSkuLabel
            ? `Xóa dòng giá cho phân loại "${deleteTarget.variantSkuLabel}"? Hành động này không thể hoàn tác.`
            : 'Xóa dòng giá này? Hành động này không thể hoàn tác.'
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        confirmVariant="danger"
        confirmLoading={deleting}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}

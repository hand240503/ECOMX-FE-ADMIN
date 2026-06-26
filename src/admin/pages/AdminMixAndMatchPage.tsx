import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Layers, Pause, Pencil, Play, Plus, Trash2, X, UploadCloud } from 'lucide-react';
import { adminProductService, type VolumePriceTier } from '../../api/services/adminProductService';
import { adminPromotionService } from '../../api/services/adminPromotionService';
import { AdminBulkImportModal } from '../components/AdminBulkImportModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { formatPrice } from '../../lib/formatPrice';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ProductPickerInline } from '../components/pricing/ProductPickerInline';
import { StatusBadge } from '../components/pricing/StatusBadge';

type DraftTier = Pick<VolumePriceTier, 'minQuantity' | 'unitPrice' | 'enabled'> & { key: string };

function toDraft(t: VolumePriceTier): DraftTier {
  return { key: String(t.id), minQuantity: t.minQuantity, unitPrice: t.unitPrice, enabled: t.enabled };
}

function emptyDraft(): DraftTier {
  return { key: `new-${Math.random().toString(36).slice(2)}`, minQuantity: 1, unitPrice: 0, enabled: true };
}

function programStatus(tiers: VolumePriceTier[]): 'active' | 'disabled' {
  return tiers.some((t) => t.enabled) ? 'active' : 'disabled';
}

export default function AdminMixAndMatchPage() {
  const queryClient = useQueryClient();
  const [viewProductId, setViewProductId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formProductId, setFormProductId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const productQuery = useQuery({
    queryKey: ['admin-product', viewProductId],
    queryFn: ({ signal }) => adminProductService.getById(viewProductId as number, signal),
    enabled: viewProductId != null,
  });

  const tiersQuery = useQuery({
    queryKey: ['admin-volume-tiers', viewProductId],
    queryFn: ({ signal }) => adminProductService.listVolumePriceTiers(viewProductId as number, signal),
    enabled: viewProductId != null,
  });

  // Tổng quan: tất cả sản phẩm đang chạy chương trình Mix & Match (hiển thị ngay khi vào trang).
  const allQuery = useQuery({
    queryKey: ['admin-volume-tiers-all'],
    queryFn: ({ signal }) => adminPromotionService.listAllVolumeTiers(signal),
  });

  const overviewGroups = useMemo(() => {
    const groups = new Map<
      number,
      { productId: number; tiers: number; enabled: number; variants: Set<number> }
    >();
    for (const t of allQuery.data ?? []) {
      if (t.productId == null || t.productId <= 0) continue;
      const g =
        groups.get(t.productId) ?? { productId: t.productId, tiers: 0, enabled: 0, variants: new Set<number>() };
      g.tiers += 1;
      if (t.enabled) g.enabled += 1;
      if (t.productVariantId != null && t.productVariantId > 0) g.variants.add(t.productVariantId);
      groups.set(t.productId, g);
    }
    return [...groups.values()].sort((a, b) => b.enabled - a.enabled || b.tiers - a.tiers);
  }, [allQuery.data]);

  const overviewProductIds = useMemo(() => overviewGroups.map((g) => g.productId), [overviewGroups]);

  const overviewProductQueries = useQueries({
    queries: overviewProductIds.map((pid) => ({
      queryKey: ['admin-product', pid],
      queryFn: ({ signal }: { signal: AbortSignal }) => adminProductService.getById(pid, signal),
      staleTime: 60_000,
    })),
  });

  const overviewProductNames = useMemo(() => {
    const map = new Map<number, string>();
    overviewProductIds.forEach((pid, i) => {
      const data = overviewProductQueries[i]?.data as { productName?: string } | undefined;
      if (data?.productName) map.set(pid, data.productName);
    });
    return map;
  }, [overviewProductIds, overviewProductQueries]);

  // Load tiers vào draft khi mở form với product
  const formTiersQuery = useQuery({
    queryKey: ['admin-volume-tiers', formProductId],
    queryFn: ({ signal }) => adminProductService.listVolumePriceTiers(formProductId as number, signal),
    enabled: formOpen && formProductId != null,
  });

  useEffect(() => {
    if (!formOpen) return;
    const data = formTiersQuery.data;
    if (data == null) return;
    setDraft(data.length > 0 ? data.map(toDraft) : [emptyDraft()]);
  }, [formOpen, formTiersQuery.data]);

  const openCreate = useCallback(() => {
    setFormProductId(viewProductId);
    setDraft([emptyDraft()]);
    setFormOpen(true);
  }, [viewProductId]);

  const openEdit = useCallback(() => {
    if (viewProductId == null) return;
    setFormProductId(viewProductId);
    setFormOpen(true);
  }, [viewProductId]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setFormProductId(null);
    setDraft([]);
  }, []);

  const addRow = useCallback(() => setDraft((p) => [...p, emptyDraft()]), []);
  const removeRow = useCallback((key: string) => setDraft((p) => p.filter((x) => x.key !== key)), []);
  const updateRow = useCallback(
    (key: string, patch: Partial<DraftTier>) =>
      setDraft((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x))),
    []
  );

  const onSave = useCallback(async () => {
    if (formProductId == null) {
      notify.error('Cần chọn sản phẩm.');
      return;
    }

    const normalized = draft
      .map((t) => ({
        minQuantity: Number(t.minQuantity),
        unitPrice: Number(t.unitPrice),
        enabled: Boolean(t.enabled),
      }))
      .filter((t) => Number.isFinite(t.minQuantity) && Number.isFinite(t.unitPrice));

    if (normalized.length === 0) {
      notify.error('Cần ít nhất 1 bậc giá. Để xóa hết, dùng nút Xóa chương trình.');
      return;
    }

    for (const t of normalized) {
      if (!Number.isInteger(t.minQuantity) || t.minQuantity <= 0) {
        notify.error('Số lượng tối thiểu phải là số nguyên dương.');
        return;
      }
      if (t.unitPrice < 0) {
        notify.error('Đơn giá không được âm.');
        return;
      }
    }

    const seen = new Set<number>();
    for (const t of normalized) {
      if (seen.has(t.minQuantity)) {
        notify.error('Số lượng tối thiểu không được trùng nhau.');
        return;
      }
      seen.add(t.minQuantity);
    }

    const sorted = [...normalized].sort((a, b) => a.minQuantity - b.minQuantity);
    setSaving(true);
    try {
      await adminProductService.replaceVolumePriceTiers(formProductId, sorted);
      notify.success('Đã lưu bậc giá');
      setViewProductId(formProductId);
      await queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers', formProductId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers-all'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không lưu được'));
    } finally {
      setSaving(false);
    }
  }, [draft, formProductId, queryClient, closeForm]);

  const toggleAll = useCallback(
    async (next: boolean) => {
      if (viewProductId == null) return;
      const current = tiersQuery.data ?? [];
      if (current.length === 0) return;
      try {
        await adminProductService.replaceVolumePriceTiers(
          viewProductId,
          current.map((t) => ({ minQuantity: t.minQuantity, unitPrice: t.unitPrice, enabled: next }))
        );
        notify.success(next ? 'Đã bật toàn bộ bậc giá' : 'Đã tắt toàn bộ bậc giá');
        await queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers', viewProductId] });
        void queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers-all'] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Không cập nhật được'));
      }
    },
    [viewProductId, tiersQuery.data, queryClient]
  );

  const onConfirmDelete = useCallback(async () => {
    if (viewProductId == null) return;
    setDeleting(true);
    try {
      await adminProductService.replaceVolumePriceTiers(viewProductId, []);
      notify.success('Đã xóa toàn bộ bậc giá. Sản phẩm về giá catalog.');
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers', viewProductId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers-all'] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không xóa được'));
    } finally {
      setDeleting(false);
    }
  }, [viewProductId, queryClient]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const tiers = tiersQuery.data ?? [];
  const hasProgram = viewProductId != null && tiers.length > 0;
  const status = hasProgram ? programStatus(tiers) : null;

  // Reference price: tier 1 base hoặc giá catalog
  const basePriceForCard = useMemo(() => {
    if (productQuery.data?.prices?.[0]?.currentValue != null) return productQuery.data.prices[0].currentValue;
    return null;
  }, [productQuery.data]);

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Giá theo bậc số lượng (Mix & match)"
        extra={
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            <UploadCloud className="size-4" aria-hidden />
            Nhập Excel
          </button>
        }
        cta={{ label: 'Tạo chương trình', onClick: () => (formOpen ? closeForm() : openCreate()), open: formOpen }}
      />

      <AdminBulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Nhập giá theo số lượng (Mix & Match) từ Excel"
        subtitle="Mỗi dòng = một mốc giá theo số lượng cho một biến thể (variant_id hoặc sku_code). Thời gian chọn sau khi xem review."
        requireTimeWindow
        importFn={(f, w) => adminPromotionService.importVolumeTiers(f, w!)}
        templateFn={() => adminPromotionService.downloadVolumeTierTemplate()}
        templateFileName="mau_import_mix_match.xlsx"
        onImported={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-volume-tiers-all'] });
        }}
      />

      <AddFormShell
        open={formOpen}
        title={formProductId != null && (formTiersQuery.data?.length ?? 0) > 0 ? 'Sửa bậc giá' : 'Tạo bậc giá mới'}
        onClose={closeForm}
        footer={
          <>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || formProductId == null}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Huỷ
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
          Sản phẩm
          <ProductPickerInline value={formProductId} onChange={(id) => setFormProductId(id)} required />
        </label>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Bậc giá</p>
          <div className="space-y-2">
            {draft.map((row, idx) => (
              <div
                key={row.key}
                className={clsx(
                  'grid grid-cols-1 items-end gap-2 rounded-lg border p-3',
                  'bg-[var(--bg-base)] sm:grid-cols-[80px_1fr_1fr_auto_auto]',
                  row.enabled
                    ? idx === 0
                      ? 'border-l-2 border-l-[var(--bg-border)] border-[var(--bg-border)]'
                      : 'border-l-2 border-l-[var(--success)] border-[var(--bg-border)]'
                    : 'border-[var(--bg-border)] opacity-60'
                )}
              >
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Tier {idx + 1}</div>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  Mua từ (SL)
                  <input
                    type="number"
                    value={row.minQuantity}
                    onChange={(e) => updateRow(row.key, { minQuantity: Number(e.target.value) })}
                    className={clsx(inputCls, 'py-1.5')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  Đơn giá (VND)
                  <input
                    type="number"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: Number(e.target.value) })}
                    className={clsx(inputCls, 'py-1.5')}
                  />
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(row.key, { enabled: e.target.checked })}
                    className="size-4 rounded border-[var(--bg-border)]"
                  />
                  Bật
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="inline-flex items-center justify-center rounded-md border border-[var(--bg-border)] p-2 text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                  aria-label="Xóa tier"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <Plus className="size-4" aria-hidden />
            Thêm bậc
          </button>
        </div>
      </AddFormShell>

      {/* Filter — chọn product để xem chương trình */}
      <div
        className={clsx(
          'flex flex-col gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-3',
          'sm:flex-row sm:items-center'
        )}
      >
        <div className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Đang xem
        </div>
        <div className="flex-1">
          <ProductPickerInline
            value={viewProductId}
            onChange={setViewProductId}
            placeholder="Chọn sản phẩm để xem bậc giá…"
          />
        </div>
      </div>

      {viewProductId == null ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Tất cả sản phẩm có chương trình Mix &amp; Match
            </h2>
            {allQuery.data ? (
              <span className="text-xs text-[var(--text-muted)]">{overviewGroups.length} sản phẩm</span>
            ) : null}
          </div>
          {allQuery.isLoading ? (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
              Đang tải danh sách…
            </div>
          ) : allQuery.isError ? (
            <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
              {getApiErrorMessage(allQuery.error, 'Không tải được danh sách')}
            </div>
          ) : overviewGroups.length === 0 ? (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
              Chưa có sản phẩm nào chạy Mix &amp; Match. Bấm “Tạo chương trình” hoặc “Nhập Excel” để bắt đầu.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {overviewGroups.map((g) => (
                <li key={g.productId}>
                  <button
                    type="button"
                    onClick={() => setViewProductId(g.productId)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Layers className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {overviewProductNames.get(g.productId) ?? `Sản phẩm #${g.productId}`}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {g.tiers} bậc giá · {g.variants.size} phân loại
                      </p>
                    </div>
                    {g.enabled > 0 ? (
                      <StatusBadge tone="success" label="Đang bật" />
                    ) : (
                      <StatusBadge tone="neutral" label="Đã tắt" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : tiersQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải…
        </div>
      ) : tiersQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(tiersQuery.error, 'Không tải được')}
        </div>
      ) : !hasProgram ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          Sản phẩm chưa có chương trình volume. Bấm “Tạo chương trình” để thêm bậc giá đầu tiên.
        </div>
      ) : (
        <article
          className={clsx(
            'overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)]',
            'shadow-[var(--card-shadow)]',
            status === 'disabled' && 'opacity-60'
          )}
        >
          <header className="flex flex-wrap items-center gap-3 border-b border-[var(--bg-border)] px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <Layers className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {productQuery.data?.productName ?? `Sản phẩm #${viewProductId}`}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {tiers.length} bậc giá
                {basePriceForCard != null ? ` · giá catalog ${formatPrice(basePriceForCard)}` : ''}
              </p>
            </div>
            {status === 'active' ? (
              <StatusBadge tone="success" label="Đang bật" />
            ) : (
              <StatusBadge tone="neutral" label="Đã tắt" />
            )}
            <div className="flex items-center gap-1">
              {status === 'active' ? (
                <button
                  type="button"
                  onClick={() => void toggleAll(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-1 text-xs font-semibold text-[var(--warning)] hover:brightness-110"
                >
                  <Pause className="size-3.5" aria-hidden />
                  Tắt hết
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void toggleAll(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--success)]/40 bg-[var(--success)]/10 px-2 py-1 text-xs font-semibold text-[var(--success)] hover:brightness-110"
                >
                  <Play className="size-3.5" aria-hidden />
                  Bật
                </button>
              )}
              <button
                type="button"
                onClick={openEdit}
                className="rounded-md p-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                aria-label="Sửa"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                aria-label="Xóa"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </header>
          <div
            className="grid gap-3 px-4 py-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {tiers
              .slice()
              .sort((a, b) => a.minQuantity - b.minQuantity)
              .map((t, idx) => {
                const base = tiers[0]?.unitPrice ?? null;
                const pct = base != null && base > 0 ? ((t.unitPrice - base) / base) * 100 : null;
                return (
                  <div
                    key={t.id}
                    className={clsx(
                      'rounded-lg border bg-[var(--bg-base)] px-3 py-3 transition-opacity',
                      idx === 0
                        ? 'border-l-2 border-l-[var(--bg-border)] border-[var(--bg-border)]'
                        : 'border-l-2 border-l-[var(--success)] border-[var(--bg-border)]',
                      !t.enabled && 'opacity-50'
                    )}
                  >
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Mua ≥ {t.minQuantity}</p>
                    <p className="mt-1 font-[family-name:var(--font-admin-mono)] text-sm font-semibold text-[var(--text-primary)]">
                      {formatPrice(t.unitPrice)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      Tier {idx + 1}
                      {pct != null && idx > 0 ? ` · ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : ' · base'}
                      {!t.enabled ? ' · tắt' : ''}
                    </p>
                  </div>
                );
              })}
          </div>
        </article>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Xóa toàn bộ bậc giá?"
        message="Toàn bộ tier của sản phẩm sẽ bị xóa và sản phẩm trở về giá catalog. Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        confirmVariant="danger"
        confirmLoading={deleting}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => !deleting && setDeleteOpen(false)}
      />
    </div>
  );
}

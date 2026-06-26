import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowRight, Gift, Pause, Pencil, Play, Tag, Trash2, UploadCloud } from 'lucide-react';
import { adminProductService } from '../../api/services/adminProductService';
import { adminPromotionService } from '../../api/services/adminPromotionService';
import { AdminBulkImportModal } from '../components/AdminBulkImportModal';
import type { ProductFullResponse } from '../../api/types/product.types';
import type { PurchaseWithPurchaseOffer, PurchaseWithPurchaseOfferUpsert } from '../../api/types/promotion.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { formatPrice } from '../../lib/formatPrice';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ProductPickerInline } from '../components/pricing/ProductPickerInline';
import { VariantPickerInline } from '../components/pricing/VariantPickerInline';
import { formatVariantPickLabel } from '../../lib/formatVariantLabel';
import { StatBox } from '../components/pricing/StatBox';
import { StatusBadge } from '../components/pricing/StatusBadge';

function emptyDraft(): PurchaseWithPurchaseOfferUpsert {
  return {
    anchorProductId: 0,
    anchorVariantId: 0,
    companionProductId: 0,
    companionVariantId: 0,
    promoUnitPrice: 0,
    minAnchorQuantity: 1,
    companionPromoUnitsPerAnchor: 1,
    maxCompanionPromoUnits: null,
    enabled: true,
  };
}

function variantSummaryFromProduct(product: ProductFullResponse | undefined, variantId?: number): string | null {
  if (variantId == null || variantId <= 0 || product?.variants == null) return null;
  const v = product.variants.find((row) => row.id === variantId);
  return v ? formatVariantPickLabel(v) : `(variant_id ${variantId})`;
}

function ProductMini({
  product,
  fallbackId,
  label,
  variantHint,
}: {
  product: ProductFullResponse | null | undefined;
  fallbackId: number;
  label: string;
  /** Một dòng hiển thị phân loại đã neo (SKU + variant id). */
  variantHint?: string | null;
}) {
  return (
    <div
      className={clsx(
        'flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] px-3 py-2'
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
        <Tag className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {product?.productName ?? `Sản phẩm #${fallbackId}`}
        </p>
        <p className="font-[family-name:var(--font-admin-mono)] text-[10px] text-[var(--text-muted)]">
          SPU #{fallbackId} · SKU số (SP) {product?.sku ?? '—'}
        </p>
        {variantHint?.trim() ? (
          <p className="mt-0.5 font-[family-name:var(--font-admin-mono)] text-[10px] text-[var(--accent)]">{variantHint}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPurchaseWithPurchasePage() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['admin-pwp-offers'],
    queryFn: ({ signal }) => adminPromotionService.listPurchaseWithPurchase(signal),
  });

  const offers = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  // Resolve product cho anchor + companion
  const productIds = useMemo(() => {
    const set = new Set<number>();
    for (const o of offers) {
      set.add(o.anchorProductId);
      set.add(o.companionProductId);
    }
    return Array.from(set).filter((x) => Number.isFinite(x) && x > 0);
  }, [offers]);

  const productResults = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['admin-product', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => adminProductService.getById(id, signal),
      staleTime: 60_000,
    })),
  });

  const productMap = useMemo(() => {
    const m = new Map<number, ProductFullResponse>();
    productResults.forEach((res, idx) => {
      if (res.data) m.set(productIds[idx], res.data);
    });
    return m;
  }, [productResults, productIds]);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PurchaseWithPurchaseOfferUpsert>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseWithPurchaseOffer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((offer: PurchaseWithPurchaseOffer) => {
    setEditingId(offer.id);
    setDraft({
      anchorProductId: offer.anchorProductId,
      anchorVariantId: offer.anchorVariantId ?? 0,
      companionProductId: offer.companionProductId,
      companionVariantId: offer.companionVariantId ?? 0,
      promoUnitPrice: offer.promoUnitPrice,
      minAnchorQuantity: offer.minAnchorQuantity,
      companionPromoUnitsPerAnchor: offer.companionPromoUnitsPerAnchor,
      maxCompanionPromoUnits: offer.maxCompanionPromoUnits,
      enabled: offer.enabled,
    });
    setFormOpen(true);
  }, []);

  const validate = useCallback(
    (body: PurchaseWithPurchaseOfferUpsert): string | null => {
      const isPosInt = (n: number) => Number.isInteger(n) && n > 0;
      if (!isPosInt(body.anchorProductId)) return 'Vui lòng chọn sản phẩm neo (điều kiện).';
      if (!isPosInt(body.anchorVariantId))
        return 'Vui lòng chọn phân loại của sản phẩm điều kiện.';
      if (!isPosInt(body.companionProductId)) return 'Vui lòng chọn sản phẩm đi kèm.';
      if (!isPosInt(body.companionVariantId))
        return 'Vui lòng chọn phân loại của sản phẩm đi kèm.';
      if (body.anchorProductId === body.companionProductId)
        return 'Sản phẩm neo và sản phẩm đi kèm không được trùng nhau.';
      if (!isPosInt(body.minAnchorQuantity)) return 'Số lượng tối thiểu phần neo phải từ 1 trở lên.';
      if (!isPosInt(body.companionPromoUnitsPerAnchor))
        return 'Số đơn vị đi kèm được giá KM trên mỗi bộ neo phải từ 1 trở lên.';
      if (!Number.isFinite(body.promoUnitPrice) || body.promoUnitPrice < 0)
        return 'Đơn giá khuyến mãi không hợp lệ.';
      if (body.maxCompanionPromoUnits != null && !isPosInt(body.maxCompanionPromoUnits))
        return 'Giới hạn số đơn vị đi kèm phải là số nguyên dương hoặc để trống.';
      // Mỗi companion 1 offer
      const conflict = offers.find(
        (o) =>
          typeof o.companionVariantId === 'number' &&
          o.companionVariantId > 0 &&
          o.companionVariantId === body.companionVariantId &&
          o.id !== editingId
      );
      if (conflict) return 'Phân loại đi kèm này đã có chương trình PwP khác.';
      return null;
    },
    [offers, editingId]
  );

  const onSave = useCallback(async () => {
    const body: PurchaseWithPurchaseOfferUpsert = {
      anchorProductId: Number(draft.anchorProductId),
      anchorVariantId: Number(draft.anchorVariantId),
      companionProductId: Number(draft.companionProductId),
      companionVariantId: Number(draft.companionVariantId),
      promoUnitPrice: Number(draft.promoUnitPrice),
      minAnchorQuantity: Number(draft.minAnchorQuantity),
      companionPromoUnitsPerAnchor: Number(draft.companionPromoUnitsPerAnchor),
      maxCompanionPromoUnits:
        draft.maxCompanionPromoUnits == null || String(draft.maxCompanionPromoUnits).trim() === ''
          ? null
          : Number(draft.maxCompanionPromoUnits),
      enabled: Boolean(draft.enabled),
    };

    const err = validate(body);
    if (err) {
      notify.error(err);
      return;
    }

    setSaving(true);
    try {
      if (editingId == null) {
        await adminPromotionService.createPurchaseWithPurchase(body);
        notify.success('Đã tạo chương trình mua kèm');
      } else {
        await adminPromotionService.updatePurchaseWithPurchase(editingId, body);
        notify.success('Đã cập nhật chương trình mua kèm');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-pwp-offers'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Không tạo được chương trình' : 'Không cập nhật được'));
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, queryClient, validate, closeForm]);

  const toggleEnabled = useCallback(
    async (offer: PurchaseWithPurchaseOffer, next: boolean) => {
      try {
        await adminPromotionService.updatePurchaseWithPurchase(offer.id, {
          anchorProductId: offer.anchorProductId,
          anchorVariantId: offer.anchorVariantId ?? 0,
          companionProductId: offer.companionProductId,
          companionVariantId: offer.companionVariantId ?? 0,
          promoUnitPrice: offer.promoUnitPrice,
          minAnchorQuantity: offer.minAnchorQuantity,
          companionPromoUnitsPerAnchor: offer.companionPromoUnitsPerAnchor,
          maxCompanionPromoUnits: offer.maxCompanionPromoUnits,
          enabled: next,
        });
        notify.success(next ? 'Đã bật chương trình' : 'Đã tạm dừng chương trình');
        await queryClient.invalidateQueries({ queryKey: ['admin-pwp-offers'] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Không cập nhật được'));
      }
    },
    [queryClient]
  );

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminPromotionService.deletePurchaseWithPurchase(deleteTarget.id);
      notify.success('Đã xóa chương trình');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-pwp-offers'] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không xóa được'));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, queryClient]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Chương trình mua kèm (PwP)"
        subtitle="Sản phẩm điều kiện và sản phẩm đi kèm được liên kết theo từng phân loại. Số lượng điều kiện chỉ tính đúng phân loại đã chọn; mỗi phân loại đi kèm chỉ thuộc tối đa một chương trình."
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
        cta={{
          label: 'Thêm chương trình',
          onClick: () => (formOpen ? closeForm() : openCreate()),
          open: formOpen,
        }}
      />

      <AdminBulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Nhập chương trình mua kèm (PWP) từ Excel"
        subtitle="Mỗi dòng = một ưu đãi mua kèm (anchor + companion theo variant_id hoặc sku_code). Thời gian chọn sau khi xem review."
        requireTimeWindow
        importFn={(f, w) => adminPromotionService.importPurchaseWithPurchase(f, w!)}
        templateFn={() => adminPromotionService.downloadPwpTemplate()}
        templateFileName="mau_import_mua_kem.xlsx"
        onImported={() => void queryClient.invalidateQueries({ queryKey: ['admin-pwp-offers'] })}
      />

      <AddFormShell
        open={formOpen}
        title={editingId == null ? 'Thêm chương trình mua kèm' : `Sửa chương trình #${editingId}`}
        onClose={closeForm}
        footer={
          <>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving ? 'Đang lưu…' : editingId == null ? 'Tạo mới' : 'Lưu thay đổi'}
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
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            <span>Sản phẩm neo — điều kiện kích hoạt</span>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Chỉ số lượng đúng phân loại neo trên đơn được tính làm neo; SPU của neo và đi kèm phải khác nhau.
            </span>
            <ProductPickerInline
              value={draft.anchorProductId || null}
              onChange={(id) =>
                setDraft((p) => ({
                  ...p,
                  anchorProductId: id ?? 0,
                  anchorVariantId: 0,
                }))
              }
              required
              excludeIds={draft.companionProductId ? [draft.companionProductId] : []}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            <span>Phân loại neo (bắt buộc)</span>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Chọn phân loại khớp với sản phẩm khi khách đặt hàng.
            </span>
            <VariantPickerInline
              productId={draft.anchorProductId || null}
              value={draft.anchorVariantId > 0 ? draft.anchorVariantId : null}
              onChange={(vid) => setDraft((p) => ({ ...p, anchorVariantId: vid ?? 0 }))}
              required
              autoPickSingleVariant
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            <span>Sản phẩm đi kèm — áp giá khuyến mãi</span>
            <ProductPickerInline
              value={draft.companionProductId || null}
              onChange={(id) =>
                setDraft((p) => ({
                  ...p,
                  companionProductId: id ?? 0,
                  companionVariantId: 0,
                }))
              }
              required
              excludeIds={draft.anchorProductId ? [draft.anchorProductId] : []}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            <span>Phân loại đi kèm (bắt buộc)</span>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Một phân loại đi kèm chỉ thuộc tối đa một offer PwP đang có hiệu lực quản trị (unique trên companion variant).
            </span>
            <VariantPickerInline
              productId={draft.companionProductId || null}
              value={draft.companionVariantId > 0 ? draft.companionVariantId : null}
              onChange={(vid) => setDraft((p) => ({ ...p, companionVariantId: vid ?? 0 }))}
              required
              autoPickSingleVariant
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            <span>Đơn giá khuyến mãi cho SP đi kèm (VNĐ)</span>
            <input
              type="number"
              value={draft.promoUnitPrice}
              onChange={(e) => setDraft((p) => ({ ...p, promoUnitPrice: Number(e.target.value) }))}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            <span>Số lượng tối thiểu phân loại neo trong đơn</span>
            <input
              type="number"
              value={draft.minAnchorQuantity}
              onChange={(e) => setDraft((p) => ({ ...p, minAnchorQuantity: Number(e.target.value) }))}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            <span>Số đơn vị đi kèm được giá KM / mỗi bộ neo</span>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Ví dụ: nhập 2 — với mỗi lần đủ điều kiện neo, tối đa hai đơn vị đi kèm trên đơn được tính giá khuyến mãi.
            </span>
            <input
              type="number"
              value={draft.companionPromoUnitsPerAnchor}
              onChange={(e) =>
                setDraft((p) => ({ ...p, companionPromoUnitsPerAnchor: Number(e.target.value) }))
              }
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            <span>Giới hạn số đơn vị đi kèm được giá KM (để trống = không giới hạn)</span>
            <input
              type="number"
              value={draft.maxCompanionPromoUnits ?? ''}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  maxCompanionPromoUnits: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] md:col-span-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((p) => ({ ...p, enabled: e.target.checked }))}
              className="size-4 rounded border-[var(--bg-border)]"
            />
            Kích hoạt ngay khi lưu (có hiệu lực trên hệ thống)
          </label>
        </div>
      </AddFormShell>

      {/* Offer cards */}
      {listQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được')}
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          Chưa có chương trình mua kèm nào. Nhấn nút “Thêm chương trình” phía trên để tạo bản ghi đầu tiên.
        </div>
      ) : (
        <ul className="grid gap-3">
          {offers.map((o) => {
            const anchor = productMap.get(o.anchorProductId);
            const companion = productMap.get(o.companionProductId);
            const companionVar = companion?.variants?.find((v) => v.id === (o.companionVariantId ?? 0));
            const companionCatalogPrice =
              companionVar?.effectiveUnitPrice ??
              companionVar?.prices?.[0]?.currentValue ??
              companion?.prices?.[0]?.currentValue ??
              null;
            const status = o.enabled ? 'success' : 'neutral';
            return (
              <li key={o.id}>
                <article
                  className={clsx(
                    'overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)]',
                    'shadow-[var(--card-shadow)] transition-opacity',
                    !o.enabled && 'opacity-60'
                  )}
                >
                  <header className="flex flex-wrap items-center gap-3 border-b border-[var(--bg-border)] px-4 py-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Gift className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Chương trình #{o.id}
                      </p>
                    </div>
                    <StatusBadge tone={status} label={o.enabled ? 'Đang hoạt động' : 'Tạm dừng'} />
                    <div className="flex items-center gap-1">
                      {o.enabled ? (
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(o, false)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-1 text-xs font-semibold text-[var(--warning)] hover:brightness-110"
                        >
                          <Pause className="size-3.5" aria-hidden />
                          Dừng
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(o, true)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--success)]/40 bg-[var(--success)]/10 px-2 py-1 text-xs font-semibold text-[var(--success)] hover:brightness-110"
                        >
                          <Play className="size-3.5" aria-hidden />
                          Bật lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(o)}
                        className="rounded-md p-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        aria-label="Sửa"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(o)}
                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                        aria-label="Xóa"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </header>
                  {/* Flow visualization — anchor → companion → promo */}
                  <div className="flex flex-col items-stretch gap-2 px-4 py-4 sm:flex-row sm:items-center">
                    <ProductMini
                      product={anchor}
                      fallbackId={o.anchorProductId}
                      label="Neo"
                      variantHint={variantSummaryFromProduct(anchor, o.anchorVariantId ?? undefined)}
                    />
                    <ArrowRight className="hidden size-4 shrink-0 text-[var(--text-muted)] sm:block" aria-hidden />
                    <ProductMini
                      product={companion}
                      fallbackId={o.companionProductId}
                      label="Đi kèm"
                      variantHint={variantSummaryFromProduct(companion, o.companionVariantId ?? undefined)}
                    />
                    <ArrowRight className="hidden size-4 shrink-0 text-[var(--text-muted)] sm:block" aria-hidden />
                    <div
                      className={clsx(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2',
                        o.enabled
                          ? 'border-[var(--success)]/40 bg-[var(--success)]/10'
                          : 'border-[var(--bg-border)] bg-[var(--bg-base)]'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={clsx(
                            'text-[10px] font-semibold uppercase tracking-wide',
                            o.enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
                          )}
                        >
                          Giá khuyến mãi / đơn vị
                        </p>
                        <p
                          className={clsx(
                            'truncate font-[family-name:var(--font-admin-mono)] text-sm font-semibold',
                            o.enabled ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'
                          )}
                        >
                          {formatPrice(o.promoUnitPrice)}
                        </p>
                        {companionCatalogPrice != null && companionCatalogPrice > o.promoUnitPrice ? (
                          <p className="font-[family-name:var(--font-admin-mono)] text-[10px] text-[var(--text-muted)] line-through">
                            Giá niêm yết {formatPrice(companionCatalogPrice)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-[var(--bg-border)] px-4 py-3 sm:grid-cols-3">
                    <StatBox label="SL tối thiểu neo" value={`≥ ${o.minAnchorQuantity}`} />
                    <StatBox label="Đơn vị đi kèm / bộ neo" value={`× ${o.companionPromoUnitsPerAnchor}`} />
                    <StatBox
                      label="Tối đa đơn vị đi kèm (KM)"
                      value={o.maxCompanionPromoUnits == null ? 'Không giới hạn' : `${o.maxCompanionPromoUnits}`}
                      tone={o.maxCompanionPromoUnits == null ? 'muted' : 'default'}
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Xóa chương trình mua kèm?"
        message={
          deleteTarget
            ? `Chương trình #${deleteTarget.id} (neo SPU #${deleteTarget.anchorProductId} / variant #${deleteTarget.anchorVariantId ?? '—'} → đi kèm SPU #${deleteTarget.companionProductId} / variant #${deleteTarget.companionVariantId ?? '—'}) sẽ bị gỡ khỏi hệ thống.`
            : ''
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

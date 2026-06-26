import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Copy, CreditCard, Pause, Pencil, Play, Tag, Trash2, UploadCloud } from 'lucide-react';
import { adminProductService } from '../../api/services/adminProductService';
import { adminPromotionService } from '../../api/services/adminPromotionService';
import { AdminBulkImportModal } from '../components/AdminBulkImportModal';
import { orderService } from '../../api/services/orderService';
import type { ProductPriceChange, ProductPriceChangeUpsert, ProductFullResponse } from '../../api/types/product.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { formatPrice } from '../../lib/formatPrice';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ProductPickerInline } from '../components/pricing/ProductPickerInline';
import { StatBox } from '../components/pricing/StatBox';
import { StatusBadge } from '../components/pricing/StatusBadge';

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

/** Đảm bảo gửi lên API là ISO 8601 (UTC `…Z`) để khớp Jackson / hướng dẫn BE. */
function toIso8601ForApi(value: string): string {
  const t = value?.trim();
  if (!t) return new Date().toISOString();
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toISOString();
}

type FormState = {
  productId: number | null;
  /** SKU — path mới; null = legacy (một phân loại). @see docs/FE_PRODUCT_VARIANTS.md §4.2 */
  variantId: number | null;
  basePrice: number;
  salePriceInput: string;
  startAt: string;
  endAtInput: string;
  enabled: boolean;
  /** Tổng quota được bán theo giá PC. '' = không giới hạn. @Min(1) nếu đặt. */
  quantityLimitInput: string;
  /** Mỗi khách mua tối đa bao nhiêu đơn vị. '' = không giới hạn. @Min(1) nếu đặt. */
  maxPerCustomerInput: string;
  /** Mã PTTT bắt buộc (VNPAY, …). '' = mọi phương thức. */
  requiredPaymentMethodCode: string;
};

function emptyForm(productId: number | null, variantId: number | null): FormState {
  return {
    productId,
    variantId,
    basePrice: 0,
    salePriceInput: '',
    startAt: new Date().toISOString(),
    endAtInput: '',
    enabled: true,
    quantityLimitInput: '',
    maxPerCustomerInput: '',
    requiredPaymentMethodCode: '',
  };
}

type ProgramStatus = 'running' | 'upcoming' | 'expired' | 'disabled';

function getProgramStatus(p: ProductPriceChange): ProgramStatus {
  if (!p.enabled) return 'disabled';
  const now = Date.now();
  const start = new Date(p.startAt).getTime();
  const end = p.endAt ? new Date(p.endAt).getTime() : Number.POSITIVE_INFINITY;
  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'running';
}

function statusBadge(status: ProgramStatus) {
  switch (status) {
    case 'running':
      return <StatusBadge tone="success" label="Đang chạy" />;
    case 'upcoming':
      return <StatusBadge tone="info" label="Sắp diễn ra" />;
    case 'disabled':
      return <StatusBadge tone="danger" label="Đã dừng" />;
    case 'expired':
      return <StatusBadge tone="neutral" label="Đã kết thúc" />;
  }
}


function formatDateTime(iso: string | null): string {
  if (!iso) return '∞';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Đã tới `startAt` → đợt đã/đang chạy theo lịch: chỉ được dừng (tắt), không xóa. */
function priceChangeHasReachedStart(p: ProductPriceChange): boolean {
  const start = new Date(p.startAt).getTime();
  if (Number.isNaN(start)) return true;
  return Date.now() >= start;
}

function canDeletePriceChange(p: ProductPriceChange): boolean {
  return !priceChangeHasReachedStart(p);
}

export default function AdminPriceChangesPage() {
  const queryClient = useQueryClient();
  const [viewProductId, setViewProductId] = useState<number | null>(null);
  /** null + có `variants[]` → dùng phần tử đầu sau khi tải product; null không variant → legacy path */
  const [viewVariantId, setViewVariantId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(null, null));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductPriceChange | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** `0` không phải id hợp lệ — tránh gọi GET `/products/0` khi state lệch. */
  const viewProductIdReady = viewProductId != null && viewProductId > 0;

  const productQuery = useQuery({
    queryKey: ['admin-product', viewProductId],
    queryFn: ({ signal }) => adminProductService.getById(viewProductId as number, signal),
    enabled: viewProductIdReady,
  });

  const variantChoices = useMemo(() => {
    const v = (productQuery.data as ProductFullResponse | undefined)?.variants;
    if (!Array.isArray(v) || v.length === 0) return [];
    return [...v].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [productQuery.data]);

  const hasProductVariants = variantChoices.length > 0;

  const effectiveListVariantId = useMemo(() => {
    if (!hasProductVariants) return undefined;
    if (viewVariantId != null && variantChoices.some((x) => x.id === viewVariantId)) return viewVariantId;
    return variantChoices[0]?.id;
  }, [hasProductVariants, variantChoices, viewVariantId]);

  useEffect(() => {
    if (!viewProductIdReady) {
      setViewVariantId(null);
      return;
    }
    if (!hasProductVariants) {
      setViewVariantId(null);
      return;
    }
    const firstId = variantChoices[0]?.id;
    setViewVariantId((cur) => {
      if (cur != null && variantChoices.some((v) => v.id === cur)) return cur;
      return firstId ?? null;
    });
  }, [viewProductId, viewProductIdReady, hasProductVariants, variantChoices]);

  const listCanLoad =
    viewProductIdReady &&
    productQuery.isFetched &&
    hasProductVariants &&
    effectiveListVariantId != null &&
    effectiveListVariantId > 0;

  const viewProductLoading =
    viewProductIdReady && (productQuery.isPending || productQuery.isFetching);
  const viewProductReadyNoVariants =
    viewProductIdReady && productQuery.isFetched && !hasProductVariants;

  const listQuery = useQuery({
    queryKey: ['admin-price-changes', viewProductId, effectiveListVariantId],
    queryFn: ({ signal }) =>
      adminProductService.listPriceChanges(viewProductId as number, {
        signal,
        variantId: effectiveListVariantId as number,
      }),
    enabled: listCanLoad,
  });

  // Tổng quan: tất cả sản phẩm đang chạy chương trình đổi giá (hiển thị ngay khi vào trang).
  const allQuery = useQuery({
    queryKey: ['admin-price-changes-all'],
    queryFn: ({ signal }) => adminPromotionService.listAllPriceChanges(signal),
  });

  const overviewProductIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of allQuery.data ?? []) {
      if (r.productId != null && r.productId > 0) ids.add(r.productId);
    }
    return [...ids];
  }, [allQuery.data]);

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
      const data = overviewProductQueries[i]?.data as ProductFullResponse | undefined;
      if (data?.productName) map.set(pid, data.productName);
    });
    return map;
  }, [overviewProductIds, overviewProductQueries]);

  /** Gom chương trình theo sản phẩm, kèm số đang chạy để hiển thị tổng quan. */
  const overviewGroups = useMemo(() => {
    const groups = new Map<number, { productId: number; total: number; running: number }>();
    for (const r of allQuery.data ?? []) {
      if (r.productId == null || r.productId <= 0) continue;
      const g = groups.get(r.productId) ?? { productId: r.productId, total: 0, running: 0 };
      g.total += 1;
      if (getProgramStatus(r) === 'running') g.running += 1;
      groups.set(r.productId, g);
    }
    return [...groups.values()].sort((a, b) => b.running - a.running || b.total - a.total);
  }, [allQuery.data]);

  const formCatalogPricesQuery = useQuery({
    queryKey: ['admin-product-catalog-prices', form.productId],
    queryFn: ({ signal }) => adminProductService.listCatalogPrices(form.productId as number, signal),
    enabled: Boolean(formOpen && form.productId != null && form.productId > 0),
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => orderService.listPaymentMethods(),
    staleTime: 5 * 60 * 1000,
  });

  const formPickerProductQuery = useQuery({
    queryKey: ['admin-product', 'price-change-form', form.productId],
    queryFn: ({ signal }) => adminProductService.getById(form.productId as number, signal),
    enabled: Boolean(
      formOpen &&
        form.productId != null &&
        form.productId > 0 &&
        form.productId !== viewProductId
    ),
  });

  const resolvedFormProduct = useMemo((): ProductFullResponse | undefined => {
    if (form.productId == null) return undefined;
    if (form.productId === viewProductId) return productQuery.data;
    return formPickerProductQuery.data;
  }, [form.productId, viewProductId, productQuery.data, formPickerProductQuery.data]);

  const formVariantChoices = useMemo(() => {
    const v = resolvedFormProduct?.variants;
    if (!Array.isArray(v) || v.length === 0) return [];
    return [...v].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [resolvedFormProduct]);

  useEffect(() => {
    if (!formOpen || editingId != null) return;
    if (formVariantChoices.length !== 1) return;
    if (form.variantId != null && form.variantId > 0) return;
    setForm((f) => ({ ...f, variantId: formVariantChoices[0].id }));
  }, [formOpen, editingId, form.variantId, formVariantChoices]);

  /** Dòng giá catalog đúng phân loại đang chọn (không fallback nhầm SKU khác). */
  const formCatalogRowForVariant = useMemo(() => {
    const rows = formCatalogPricesQuery.data;
    if (!rows?.length) return undefined;
    const vid = form.variantId;
    if (vid != null && vid > 0) {
      const byV = rows.find((r) => r.productVariantId === vid);
      if (byV) return byV;
    }
    if (rows.length === 1 && formVariantChoices.length === 1) return rows[0];
    return undefined;
  }, [formCatalogPricesQuery.data, form.variantId, formVariantChoices.length]);

  const catalogBasePriceVnd = useMemo(() => {
    const raw = formCatalogRowForVariant?.currentValue;
    if (raw == null || !Number.isFinite(Number(raw))) return null;
    const n = Math.round(Number(raw));
    return n >= 0 ? n : null;
  }, [formCatalogRowForVariant?.currentValue]);

  /** Giá gốc đợt giá = giá catalog của phân loại; luôn đồng bộ (tạo mới + sửa). */
  useEffect(() => {
    if (!formOpen || form.productId == null || form.productId <= 0) return;
    if (form.variantId == null || form.variantId <= 0) return;
    if (!formCatalogPricesQuery.isSuccess) return;
    if (catalogBasePriceVnd == null) {
      setForm((f) => {
        if (f.productId !== form.productId || f.variantId !== form.variantId) return f;
        return f.basePrice === 0 ? f : { ...f, basePrice: 0 };
      });
      return;
    }
    setForm((f) => {
      if (f.productId !== form.productId || f.variantId !== form.variantId) return f;
      if (f.basePrice === catalogBasePriceVnd) return f;
      return { ...f, basePrice: catalogBasePriceVnd };
    });
  }, [
    formOpen,
    form.productId,
    form.variantId,
    formCatalogPricesQuery.isSuccess,
    catalogBasePriceVnd,
  ]);

  const computedPercent = useMemo(() => {
    const sale = form.salePriceInput.trim() === '' ? null : Number(form.salePriceInput);
    if (sale == null || !Number.isFinite(sale) || form.basePrice <= 0) return null;
    const pct = ((sale - form.basePrice) / form.basePrice) * 100;
    if (!Number.isFinite(pct)) return null;
    return pct;
  }, [form.basePrice, form.salePriceInput]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    const defaultVid =
      hasProductVariants && effectiveListVariantId != null ? effectiveListVariantId : null;
    setForm(emptyForm(viewProductIdReady ? viewProductId : null, defaultVid));
    setFormOpen(true);
  }, [viewProductId, viewProductIdReady, hasProductVariants, effectiveListVariantId]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
  }, []);

  const startEdit = useCallback(
    (row: ProductPriceChange) => {
      const pid =
        row.productId > 0 ? row.productId : viewProductIdReady && viewProductId != null ? viewProductId : null;
      const vid =
        row.productVariantId != null && row.productVariantId > 0
          ? row.productVariantId
          : effectiveListVariantId ?? null;
      setEditingId(row.id);
      setForm({
        productId: pid,
        variantId: vid,
        basePrice: row.basePrice,
        salePriceInput: row.salePrice == null ? '' : String(row.salePrice),
        startAt: row.startAt,
        endAtInput: row.endAt == null ? '' : toDatetimeLocalValue(row.endAt),
        enabled: row.enabled,
        quantityLimitInput: row.quantityLimit == null ? '' : String(row.quantityLimit),
        maxPerCustomerInput: row.maxPerCustomer == null ? '' : String(row.maxPerCustomer),
        requiredPaymentMethodCode: row.requiredPaymentMethodCode ?? '',
      });
      setFormOpen(true);
    },
    [effectiveListVariantId, viewProductId, viewProductIdReady]
  );

  const startDuplicate = useCallback(
    (row: ProductPriceChange) => {
      const pid =
        row.productId > 0 ? row.productId : viewProductIdReady && viewProductId != null ? viewProductId : null;
      const vid =
        row.productVariantId != null && row.productVariantId > 0
          ? row.productVariantId
          : effectiveListVariantId ?? null;
      setEditingId(null);
      setForm({
        productId: pid,
        variantId: vid,
        basePrice: row.basePrice,
        salePriceInput: row.salePrice == null ? '' : String(row.salePrice),
        startAt: new Date().toISOString(),
        endAtInput: '',
        enabled: true,
        quantityLimitInput: row.quantityLimit == null ? '' : String(row.quantityLimit),
        maxPerCustomerInput: row.maxPerCustomer == null ? '' : String(row.maxPerCustomer),
        requiredPaymentMethodCode: row.requiredPaymentMethodCode ?? '',
      });
      setFormOpen(true);
    },
    [effectiveListVariantId, viewProductId, viewProductIdReady]
  );

  const validate = useCallback((body: ProductPriceChangeUpsert, productId: number | null): string | null => {
    if (productId == null || !Number.isFinite(productId) || productId <= 0) {
      return 'Cần chọn sản phẩm (id hợp lệ).';
    }
    if (!Number.isFinite(body.basePrice) || body.basePrice < 0) return 'Giá gốc không hợp lệ.';
    if (body.salePrice != null) {
      if (!Number.isFinite(body.salePrice) || body.salePrice < 0) return 'Giá ưu đãi không hợp lệ.';
      if (body.salePrice > body.basePrice) return 'Giá ưu đãi phải nhỏ hơn hoặc bằng giá gốc.';
    }
    if (!body.startAt?.trim()) return 'Thời điểm bắt đầu là bắt buộc.';
    const start = new Date(body.startAt);
    if (Number.isNaN(start.getTime())) return 'Thời điểm bắt đầu không hợp lệ.';
    if (body.endAt != null) {
      const end = new Date(body.endAt);
      if (Number.isNaN(end.getTime())) return 'Thời điểm kết thúc không hợp lệ.';
      if (end.getTime() < start.getTime()) return 'Kết thúc phải sau hoặc bằng bắt đầu.';
    }
    if (body.quantityLimit != null && (body.quantityLimit < 1 || !Number.isInteger(body.quantityLimit))) {
      return 'Số lượng giới hạn phải là số nguyên >= 1.';
    }
    if (body.maxPerCustomer != null && (body.maxPerCustomer < 1 || !Number.isInteger(body.maxPerCustomer))) {
      return 'Số lượng tối đa mỗi khách phải là số nguyên >= 1.';
    }
    if (body.requiredPaymentMethodCode != null && body.requiredPaymentMethodCode.length > 64) {
      return 'Mã phương thức thanh toán không được vượt quá 64 ký tự.';
    }
    return null;
  }, []);

  const onSave = useCallback(async () => {
    const productId = form.productId;
    const saleParsed = form.salePriceInput.trim() === '' ? null : Number(form.salePriceInput);

    if (saleParsed != null && Number.isNaN(saleParsed)) {
      notify.error('Giá ưu đãi không hợp lệ.');
      return;
    }

    if (formVariantChoices.length === 0) {
      notify.error(
        'Sản phẩm này chưa có phân loại (SKU). Vui lòng tạo ít nhất một phân loại trong quản lý sản phẩm trước khi thêm đợt giá.'
      );
      return;
    }
    if (form.variantId == null || !Number.isFinite(form.variantId) || form.variantId <= 0) {
      notify.error('Chọn phân loại sản phẩm cho đợt giá này.');
      return;
    }

    if (formCatalogPricesQuery.isError) {
      notify.error('Không tải được giá catalog. Thử lại sau.');
      return;
    }
    if (!formCatalogPricesQuery.isSuccess) {
      notify.error('Đang tải giá catalog — vui lòng đợi.');
      return;
    }
    if (formCatalogRowForVariant == null || catalogBasePriceVnd == null || catalogBasePriceVnd <= 0) {
      notify.error(
        'Phân loại chưa có giá trong danh mục. Hãy cập nhật giá sản phẩm (catalog) trước khi lưu đợt giá.'
      );
      return;
    }

    const qlParsed = form.quantityLimitInput.trim() === '' ? null : Number(form.quantityLimitInput);
    const mcParsed = form.maxPerCustomerInput.trim() === '' ? null : Number(form.maxPerCustomerInput);
    if (qlParsed != null && (Number.isNaN(qlParsed) || !Number.isInteger(qlParsed))) {
      notify.error('Số lượng giới hạn không hợp lệ (phải là số nguyên >= 1).');
      return;
    }
    if (mcParsed != null && (Number.isNaN(mcParsed) || !Number.isInteger(mcParsed))) {
      notify.error('Số lượng tối đa mỗi khách không hợp lệ (phải là số nguyên >= 1).');
      return;
    }
    const pmCode = form.requiredPaymentMethodCode.trim().toUpperCase();

    const body: ProductPriceChangeUpsert = {
      basePrice: catalogBasePriceVnd,
      salePrice: saleParsed,
      startAt: toIso8601ForApi(form.startAt),
      endAt: form.endAtInput.trim() === '' ? null : fromDatetimeLocalValue(form.endAtInput),
      enabled: Boolean(form.enabled),
      quantityLimit: qlParsed,
      maxPerCustomer: mcParsed,
      requiredPaymentMethodCode: pmCode === '' ? null : pmCode,
    };

    const err = validate(body, productId);
    if (err) {
      notify.error(err);
      return;
    }

    const priceChangeScopeOpts = { variantId: form.variantId };

    setSaving(true);
    try {
      if (editingId == null) {
        await adminProductService.createPriceChange(productId as number, body, priceChangeScopeOpts);
        notify.success('Đã tạo đợt giá');
      } else {
        await adminProductService.updatePriceChange(
          productId as number,
          editingId,
          body,
          priceChangeScopeOpts
        );
        notify.success('Đã cập nhật đợt giá');
      }
      setViewProductId(productId);
      setViewVariantId(priceChangeScopeOpts.variantId);
      await queryClient.invalidateQueries({ queryKey: ['admin-price-changes', productId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-price-changes-all'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Không tạo được' : 'Không cập nhật được'));
    } finally {
      setSaving(false);
    }
  }, [
    editingId,
    form,
    formVariantChoices.length,
    queryClient,
    validate,
    closeForm,
    formCatalogPricesQuery.isError,
    formCatalogPricesQuery.isSuccess,
    formCatalogRowForVariant,
    catalogBasePriceVnd,
  ]);

  const resolvePriceChangeVariantId = useCallback(
    (row: ProductPriceChange): number | null => {
      const fromRow = row.productVariantId != null && row.productVariantId > 0 ? row.productVariantId : null;
      if (fromRow != null) return fromRow;
      if (effectiveListVariantId != null && effectiveListVariantId > 0) return effectiveListVariantId;
      return null;
    },
    [effectiveListVariantId]
  );

  const toggleEnabled = useCallback(
    async (row: ProductPriceChange, next: boolean) => {
      try {
        const vid = resolvePriceChangeVariantId(row);
        if (vid == null) {
          notify.error('Không xác định được phân loại của mục này.');
          return;
        }
        const productIdForApi =
          row.productId > 0 ? row.productId : viewProductIdReady && viewProductId != null ? viewProductId : null;
        if (productIdForApi == null || productIdForApi <= 0) {
          notify.error('Không xác định được sản phẩm. Vui lòng thử lại.');
          return;
        }
        await adminProductService.updatePriceChange(
          productIdForApi,
          row.id,
          {
            basePrice: Math.round(Number(row.basePrice)),
            salePrice: row.salePrice,
            startAt: toIso8601ForApi(row.startAt),
            endAt: row.endAt == null ? null : toIso8601ForApi(row.endAt),
            enabled: next,
          },
          { variantId: vid }
        );
        notify.success(next ? 'Đã kích hoạt' : 'Đã dừng');
        await queryClient.invalidateQueries({ queryKey: ['admin-price-changes', productIdForApi] });
        void queryClient.invalidateQueries({ queryKey: ['admin-price-changes-all'] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Không cập nhật được'));
      }
    },
    [queryClient, resolvePriceChangeVariantId, viewProductId, viewProductIdReady]
  );

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    if (!canDeletePriceChange(target)) {
      notify.error(
        'Không cho phép xóa đợt giá đã bắt đầu áp dụng. Chỉ có thể dừng (tắt) chương trình nếu còn đang bật.'
      );
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const vid = resolvePriceChangeVariantId(target);
      if (vid == null) {
        notify.error('Không xác định được phân loại của mục này.');
        return;
      }
      const productIdForApi =
        target.productId > 0
          ? target.productId
          : viewProductIdReady && viewProductId != null
            ? viewProductId
            : null;
      if (productIdForApi == null || productIdForApi <= 0) {
        notify.error('Không xác định được sản phẩm. Vui lòng thử lại.');
        return;
      }
      await adminProductService.deletePriceChange(productIdForApi, target.id, { variantId: vid });
      notify.success('Đã xóa đợt giá');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-price-changes', productIdForApi] });
      void queryClient.invalidateQueries({ queryKey: ['admin-price-changes-all'] });
      if (editingId === target.id) closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không xóa được'));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, editingId, queryClient, closeForm, resolvePriceChangeVariantId, viewProductId, viewProductIdReady]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Giá theo khung thời gian (Price change)"
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
        cta={{ label: 'Tạo đợt giá', onClick: () => (formOpen ? closeForm() : openCreate()), open: formOpen }}
      />

      <AdminBulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Nhập chương trình đổi giá (PC) từ Excel"
        subtitle="Mỗi dòng = một đợt đổi giá cho một biến thể (theo variant_id hoặc sku_code). Thời gian chọn sau khi xem review."
        requireTimeWindow
        importFn={(f, w) => adminPromotionService.importPriceChanges(f, w!)}
        templateFn={() => adminPromotionService.downloadPriceChangeTemplate()}
        templateFileName="mau_import_doi_gia.xlsx"
        onImported={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin-price-changes'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-price-changes-all'] });
        }}
      />

      <AddFormShell
        open={formOpen}
        title={editingId == null ? 'Tạo đợt giá mới' : `Sửa đợt giá #${editingId}`}
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
              {saving ? 'Đang lưu…' : editingId == null ? 'Tạo' : 'Cập nhật'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className={clsx(
                'rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]',
                'hover:bg-[var(--bg-elevated)]'
              )}
            >
              Huỷ
            </button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            Sản phẩm
            <ProductPickerInline
              value={form.productId}
              onChange={(id) =>
                setForm((p) => ({
                  ...p,
                  productId: id,
                  variantId: null,
                  basePrice: 0,
                  salePriceInput: '',
                }))
              }
              required
              disabled={editingId != null}
            />
          </label>
          {formVariantChoices.length > 0 ? (
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
              Phân loại sản phẩm
              <select
                className={inputCls}
                value={form.variantId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next =
                    raw === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : null;
                  setForm((p) => ({ ...p, variantId: next, basePrice: 0 }));
                }}
                disabled={editingId != null}
                required
              >
                <option value="">— Chọn —</option>
                {formVariantChoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.skuCode ? `${v.skuCode} (ID ${v.id})` : `Phân loại · ID ${v.id}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            Giá gốc (VND)
            <div
              className={clsx(
                inputCls,
                'cursor-default bg-[var(--bg-base)] font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]'
              )}
              aria-readonly="true"
            >
              {form.variantId == null || form.variantId <= 0
                ? '— Chọn phân loại —'
                : formCatalogPricesQuery.isError
                  ? 'Không tải được giá catalog'
                  : formCatalogPricesQuery.isFetching || formCatalogPricesQuery.isPending
                    ? 'Đang tải giá catalog…'
                    : formCatalogPricesQuery.isSuccess &&
                        catalogBasePriceVnd != null &&
                        catalogBasePriceVnd > 0
                      ? formatPrice(catalogBasePriceVnd)
                      : formCatalogPricesQuery.isSuccess
                        ? 'Chưa có giá catalog cho phân loại này'
                        : '—'}
            </div>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Lấy từ giá danh mục của phân loại (không chỉnh tay).
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Giá ưu đãi (VND)
            <input
              type="number"
              value={form.salePriceInput}
              onChange={(e) => setForm((p) => ({ ...p, salePriceInput: e.target.value }))}
              placeholder="Để trống = chỉ dùng giá gốc"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Bắt đầu
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(form.startAt)}
              onChange={(e) => setForm((p) => ({ ...p, startAt: fromDatetimeLocalValue(e.target.value) }))}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Kết thúc
            <input
              type="datetime-local"
              value={form.endAtInput}
              onChange={(e) => setForm((p) => ({ ...p, endAtInput: e.target.value }))}
              placeholder="Để trống = không kết thúc"
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] md:col-span-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
              className="size-4 rounded border-[var(--bg-border)]"
            />
            Kích hoạt ngay
          </label>
          {computedPercent != null ? (
            <p className="text-[11px] text-[var(--text-muted)] md:col-span-2">
              % thay đổi:{' '}
              <span
                className={clsx(
                  'font-[family-name:var(--font-admin-mono)] font-semibold',
                  computedPercent < 0 ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                )}
              >
                {computedPercent.toFixed(1)}%
              </span>
            </p>
          ) : null}

          {/* Divider */}
          <div className="md:col-span-2 border-t border-[var(--bg-border)] pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Giới hạn &amp; Phương thức thanh toán
            </p>
          </div>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Tổng số lượng (quota)
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantityLimitInput}
              onChange={(e) => setForm((p) => ({ ...p, quantityLimitInput: e.target.value }))}
              placeholder="Để trống = không giới hạn"
              className={inputCls}
            />
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Tổng số đơn vị được bán theo giá này (≥ 1).
            </span>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Tối đa mỗi khách
            <input
              type="number"
              min={1}
              step={1}
              value={form.maxPerCustomerInput}
              onChange={(e) => setForm((p) => ({ ...p, maxPerCustomerInput: e.target.value }))}
              placeholder="Để trống = không giới hạn"
              className={inputCls}
            />
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Mỗi khách mua tối đa bao nhiêu đơn vị (≥ 1).
            </span>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] md:col-span-2">
            Phương thức thanh toán bắt buộc
            <select
              className={inputCls}
              value={form.requiredPaymentMethodCode}
              onChange={(e) => setForm((p) => ({ ...p, requiredPaymentMethodCode: e.target.value }))}
            >
              <option value="">— Tất cả phương thức —</option>
              {(paymentMethodsQuery.data ?? []).map((pm) => (
                <option key={pm.code} value={pm.code}>
                  {pm.name} ({pm.code})
                </option>
              ))}
            </select>
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              Giá này chỉ áp dụng khi khách thanh toán bằng phương thức đã chọn.
            </span>
          </label>
        </div>
      </AddFormShell>

      {/* Filter — chọn product để xem các đợt giá */}
      <div
        className={clsx(
          'flex flex-col gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-3',
          'sm:flex-row sm:items-center'
        )}
      >
        <div className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Đang xem
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <ProductPickerInline
            value={viewProductIdReady ? viewProductId : null}
            onChange={(id) => {
              setViewProductId(id != null && id > 0 ? id : null);
              setViewVariantId(null);
            }}
            placeholder="Chọn sản phẩm để xem các đợt giá…"
          />
          {hasProductVariants && variantChoices.length > 1 ? (
            <label className="flex flex-col gap-1 px-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Phân loại sản phẩm
              <select
                className={inputCls}
                value={viewVariantId ?? effectiveListVariantId ?? ''}
                onChange={(e) => setViewVariantId(Number(e.target.value))}
              >
                {variantChoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.skuCode ? `${v.skuCode} (ID ${v.id})` : `Phân loại · ID ${v.id}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {/* Program cards list */}
      {!viewProductIdReady ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Tất cả sản phẩm có chương trình đổi giá
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
              Chưa có sản phẩm nào chạy chương trình đổi giá. Bấm “Tạo đợt giá” hoặc “Nhập Excel” để bắt đầu.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {overviewGroups.map((g) => (
                <li key={g.productId}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewProductId(g.productId);
                      setViewVariantId(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Tag className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {overviewProductNames.get(g.productId) ?? `Sản phẩm #${g.productId}`}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {g.total} đợt giá
                        {g.running > 0 ? ` · ${g.running} đang chạy` : ''}
                      </p>
                    </div>
                    {g.running > 0 ? (
                      <StatusBadge tone="success" label={`${g.running} đang chạy`} />
                    ) : (
                      <StatusBadge tone="neutral" label="Không chạy" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : viewProductLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải chi tiết sản phẩm…
        </div>
      ) : viewProductReadyNoVariants ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
          Sản phẩm này chưa có phân loại nào.{' '}
          Tính năng đợt giá yêu cầu sản phẩm phải có ít nhất một phân loại (SKU).
          Vui lòng tạo phân loại trong trang{' '}
          <span className="font-semibold text-[var(--text-primary)]">Quản lý sản phẩm</span>{' '}
          rồi quay lại đây.
        </div>
      ) : listQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được')}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          Chưa có đợt giá nào cho sản phẩm này.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => {
            const status = getProgramStatus(row);
            const pcStarted = priceChangeHasReachedStart(row);
            const sale = row.salePrice;
            const pct =
              sale != null && row.basePrice > 0 ? ((sale - row.basePrice) / row.basePrice) * 100 : null;
            
            const cardClasses = clsx(
              'overflow-hidden rounded-xl border transition-all duration-200 bg-[var(--bg-surface)]',
              status === 'running' && 'border-[var(--success)] shadow-[0_0_12px_rgba(34,197,94,0.12)] ring-1 ring-[var(--success)]/20',
              status === 'upcoming' && 'border-[var(--info)]/50 shadow-[0_0_12px_rgba(59,130,246,0.06)]',
              status === 'disabled' && 'border-[var(--danger)]/30 opacity-60 shadow-none',
              status === 'expired' && 'border-[var(--bg-border)] opacity-60 shadow-none'
            );

            const tagContainerClasses = clsx(
              'flex size-8 items-center justify-center rounded-md transition-colors',
              status === 'running' && 'bg-[var(--success)]/10 text-[var(--success)]',
              status === 'upcoming' && 'bg-[var(--info)]/10 text-[var(--info)]',
              status === 'disabled' && 'bg-[var(--danger)]/10 text-[var(--danger)]',
              status === 'expired' && 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
            );

            return (
              <li key={row.id}>
                <article className={cardClasses}>
                  <header className="flex flex-wrap items-center gap-3 border-b border-[var(--bg-border)] px-4 py-3">
                    <div className={tagContainerClasses}>
                      <Tag className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--text-primary)]">
                        <span className="truncate">{productQuery.data?.productName ?? `Sản phẩm #${row.productId}`}</span>
                        <span className="shrink-0 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-[family-name:var(--font-admin-mono)] text-[10px] font-bold text-[var(--text-muted)] border border-[var(--bg-border)]">
                          ID #{row.id}
                        </span>
                      </p>
                      <p className="font-[family-name:var(--font-admin-mono)] text-[11px] text-[var(--text-muted)]">
                        {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                      </p>
                      {row.productVariantId != null ? (
                        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          Phân loại · ID {row.productVariantId}
                        </p>
                      ) : null}
                    </div>
                    {statusBadge(status)}
                    <div className="flex flex-wrap items-center gap-1">
                      {status === 'running' ? (
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(row, false)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-1 text-xs font-semibold text-[var(--warning)] hover:brightness-110"
                        >
                          <Pause className="size-3.5" aria-hidden />
                          Dừng
                        </button>
                      ) : status === 'disabled' || status === 'upcoming' ? (
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(row, true)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--success)]/40 bg-[var(--success)]/10 px-2 py-1 text-xs font-semibold text-[var(--success)] hover:brightness-110"
                        >
                          <Play className="size-3.5" aria-hidden />
                          Kích hoạt
                        </button>
                      ) : null}
                      {status === 'expired' ? (
                        <button
                          type="button"
                          onClick={() => startDuplicate(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--bg-border)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                        >
                          <Copy className="size-3.5" aria-hidden />
                          Nhân bản
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="rounded-md p-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        aria-label="Sửa đợt giá"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={pcStarted}
                        title={
                          pcStarted
                            ? 'Không cho phép xóa PC đã vào thời gian áp dụng. Chỉ có thể dừng (tắt) nếu đang chạy, hoặc nhân bản sau khi kết thúc.'
                            : 'Xóa đợt giá (chỉ khi chưa tới giờ bắt đầu)'
                        }
                        onClick={() => setDeleteTarget(row)}
                        className={clsx(
                          'rounded-md p-1.5',
                          pcStarted
                            ? 'cursor-not-allowed text-[var(--text-muted)] opacity-40'
                            : 'text-[var(--danger)] hover:bg-[var(--bg-elevated)]'
                        )}
                        aria-label={
                          pcStarted
                            ? 'Không cho phép xóa đợt giá đã bắt đầu áp dụng'
                            : 'Xóa đợt giá'
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </header>
                  <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                    <StatBox label="Giá gốc" value={formatPrice(row.basePrice)} tone="muted" />
                    <StatBox
                      label="Giá ưu đãi"
                      value={sale != null ? formatPrice(sale) : '—'}
                      tone={status === 'running' ? 'success' : status === 'upcoming' ? 'info' : 'default'}
                    />
                    <StatBox
                      label="% giảm"
                      value={pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                      tone={pct != null && pct < 0 ? 'success' : 'default'}
                    />
                  </div>

                  {/* Quota + Payment method restriction */}
                  {(row.quantityLimit != null || row.maxPerCustomer != null || row.requiredPaymentMethodCode) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--bg-border)] px-4 py-2.5">
                      {row.quantityLimit != null && (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <span className="font-semibold">Quota:</span>
                          <span className="font-[family-name:var(--font-admin-mono)]">
                            {row.soldQuantity ?? 0}/{row.quantityLimit}
                          </span>
                          {row.remainingQuantity != null && (
                            <span className={clsx(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              row.remainingQuantity === 0
                                ? 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                : row.remainingQuantity <= Math.ceil(row.quantityLimit * 0.2)
                                  ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                                  : 'bg-[var(--success)]/10 text-[var(--success)]'
                            )}>
                              còn {row.remainingQuantity}
                            </span>
                          )}
                        </div>
                      )}
                      {row.maxPerCustomer != null && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <span className="font-semibold">Tối đa/khách:</span>
                          <span className="font-[family-name:var(--font-admin-mono)]">{row.maxPerCustomer}</span>
                        </div>
                      )}
                      {row.requiredPaymentMethodCode && (() => {
                        const pmList = paymentMethodsQuery.data ?? [];
                        const matchedPm = pmList.find(
                          (m) => m.code.toUpperCase() === row.requiredPaymentMethodCode?.trim().toUpperCase()
                        );
                        return (
                          <div className="flex items-center gap-1 text-xs">
                            <CreditCard className="size-3.5 text-blue-500" aria-hidden />
                            <span className="font-semibold text-blue-600">Chỉ áp dụng với:</span>
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-[family-name:var(--font-admin-mono)] text-[11px] font-bold text-blue-700">
                              {matchedPm ? `${matchedPm.name} (${row.requiredPaymentMethodCode})` : row.requiredPaymentMethodCode}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Xóa đợt giá?"
        message={
          deleteTarget
            ? `Đợt giá #${deleteTarget.id} (bắt đầu ${formatDateTime(deleteTarget.startAt)}) sẽ bị xóa.`
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

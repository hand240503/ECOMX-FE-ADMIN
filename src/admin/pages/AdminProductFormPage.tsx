import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Fragment,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type Path,
  type UseFormSetError,
  type UseFormSetFocus,
} from 'react-hook-form';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import { adminBrandService } from '../../api/services/adminBrandService';
import { adminDocumentService } from '../../api/services/adminDocumentService';
import { adminProductService } from '../../api/services/adminProductService';
import { adminUnitService } from '../../api/services/adminUnitService';
import { categoryService } from '../../api/services/categoryService';
import { UnitSelect } from '../components/pricing/UnitSelect';
import { flattenCategories } from '../../lib/categoryCatalog';
import { compactOptionalRichHtml } from '../../lib/compactOptionalRichHtml';
import { publicDocumentFileUrl } from '../../lib/documentPublicUrl';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type {
  CreatePriceRequest,
  CreateProductVariantRequest,
  ProductDocumentSummary,
  ProductFullResponse,
  ProductPrice,
  ProductPriceChange,
  PurchaseWithPurchaseProgram,
  UpdateProductPriceItemRequest,
  UpdateProductRequest,
  UpdateProductVariantItemRequest,
  VolumePriceTier,
} from '../../api/types/product.types';
import { formatIntegerViVN, formatPrice } from '../../lib/formatPrice';
import {
  documentIsMainCoverFlag,
  documentKindCanBeCover,
  documentKindIsVideo,
  firstImageFileIndex,
} from '../../lib/documentKind';
import {
  mergeUniqueTagsFromInput,
  parseProductTagList,
  serializeProductTags,
} from '../../lib/productTags';

const AdminProductRichTextEditor = lazy(() =>
  import('../components/AdminProductRichTextEditor').then((m) => ({ default: m.AdminProductRichTextEditor }))
);

type CatalogPriceRow = {
  priceId?: string;
  unitId: string;
  currentValue: string;
  referencePrice: string;
};

type VariantFormValues = {
  variantId?: string;
  skuCode: string;
  active: boolean;
  sortOrder: string;
  optionPairs: { optKey: string; optValue: string }[];
  prices: CatalogPriceRow[];
};

type FormValues = {
  productName: string;
  categoryId: string;
  brandId: string;
  sku: string;
  description: string;
  l_description: string;
  status: string;
  isFeatured: boolean;
  hotSale: boolean;
  variants: VariantFormValues[];
};

type ServerMediumItem = {
  key: string;
  title: string;
  displayUrl: string | null;
  isVideo: boolean;
  rawPath: string;
  docType: number | null;
  documentId?: number;
  isMainCover: boolean;
  coverEligible: boolean;
};

type GalleryImageSlide = {
  key: string;
  title: string;
  src: string;
};

const IMG_EXT_OR_QUERY_RX = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i;

function readDocumentIsMain(d: ProductDocumentSummary): boolean {
  const raw = d as Record<string, unknown>;
  const v = raw.isMain ?? raw.is_main;
  return v === true || v === 1 || v === 'true';
}

/** URL dùng mở xem ảnh phóng to (bỏ qua video). */
function galleryImageSrc(item: ServerMediumItem): string | null {
  if (item.isVideo) return null;
  if (item.displayUrl) return item.displayUrl;
  const raw = item.rawPath.trim();
  if (/^https?:\/\//i.test(raw)) {
    if (
      IMG_EXT_OR_QUERY_RX.test(raw) ||
      /cloudinary\.com\/.+\/image\//i.test(raw)
    ) {
      return raw;
    }
  }
  return null;
}

/** `GET variants[].documents` hoặc tương đương — @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4 */
function parseVariantDocumentsFromApiObject(o: Record<string, unknown>): ProductDocumentSummary[] {
  const raw = o.documents ?? o.documentList ?? o.media;
  if (!Array.isArray(raw)) return [];
  const out: ProductDocumentSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const id = Number(d.id);
    const fpRaw = d.filePath ?? d.file_path;
    if (!Number.isFinite(id) || id <= 0) continue;
    if (typeof fpRaw !== 'string' || !fpRaw.trim()) continue;
    const fname = d.fileName ?? d.file_name;
    const sz = d.fileSize ?? d.file_size;
    const tp = d.type;
    out.push({
      id,
      fileName: typeof fname === 'string' ? fname : undefined,
      filePath: fpRaw.trim(),
      fileSize:
        sz === null || sz === undefined ? undefined : typeof sz === 'string' ? sz : String(sz),
      type: typeof tp === 'number' ? tp : tp != null ? Number(tp) : undefined,
      isMain: readDocumentIsMain(d as ProductDocumentSummary),
    });
  }
  out.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  return out;
}

/** Map `documents[]` cấp SPU hay SKU → ô gallery (cùng quy ước `ServerMediumItem`). */
function productDocumentsToServerMediumItems(docs: ProductDocumentSummary[] | undefined | null): ServerMediumItem[] {
  const list = docs ?? [];
  if (!list.length) return [];
  return [...list]
    .filter((d) => typeof d.filePath === 'string' && d.filePath.trim() !== '')
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
    .map((d) => {
      const rawPath = d.filePath!.trim();
      const displayUrl = publicDocumentFileUrl(rawPath);
      const docType = typeof d.type === 'number' ? d.type : null;
      const isVideo = documentKindIsVideo(docType, rawPath);
      const coverEligible = documentKindCanBeCover(docType, rawPath);
      const isMainCover = documentIsMainCoverFlag(docType, readDocumentIsMain(d), rawPath);
      const fileLabel = typeof d.fileName === 'string' && d.fileName.trim() !== '' ? d.fileName.trim() : '';
      const title =
        fileLabel || (d.id != null ? `Ảnh (mã ${d.id})` : rawPath.slice(-32));
      const docIdNum = d.id != null && Number.isFinite(Number(d.id)) ? Number(d.id) : undefined;
      return {
        key: `doc-${d.id ?? rawPath}`,
        title,
        displayUrl,
        isVideo,
        rawPath,
        docType,
        documentId: docIdNum,
        isMainCover,
        coverEligible,
      };
    });
}

/** Chỉ số ảnh đại diện trong lô file đang chờ POST SKU — @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4.1 */
function normalizeVariantMultipartMainImageIndex(files: File[], ix: number): number {
  if (!files.length) return 0;
  const clamped = Math.max(0, Math.min(ix, files.length - 1));
  if (files[clamped]?.type.startsWith('image/')) return clamped;
  const fi = firstImageFileIndex(files);
  return fi ?? 0;
}

type NavigateSaveFlash =
  | { saveFlash?: 'created'; savedProductId?: number }
  | null
  | undefined;

function validateEditProductForm(values: FormValues, opts: { requireVariantSkuCodes: boolean }): string | null {
  if (!values.productName.trim()) {
    return 'Không được để trống tên được hiển thị trong cửa hàng.';
  }
  const cat = Number(values.categoryId);
  if (!Number.isFinite(cat) || cat <= 0) {
    return 'Hãy chọn danh mục chứa sản phẩm này.';
  }
  const brandRaw = values.brandId.trim();
  if (brandRaw !== '') {
    const n = Number(brandRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return 'Hãy chọn hãng hợp lệ hoặc để trống.';
    }
  }
  const skuRaw = values.sku.trim();
  const skuNum: number | null = skuRaw === '' ? null : Number(skuRaw);
  if (skuNum != null && (!Number.isFinite(skuNum) || !Number.isInteger(skuNum) || skuNum <= 0)) {
    return 'SKU phải là số nguyên dương (hoặc để trống).';
  }
  const pv = validateVariantsSection(values, opts.requireVariantSkuCodes);
  if (pv) return pv;
  return null;
}

/** @see docs/FE_PRODUCT_VARIANTS.md — cố định key như Size, Color. */
function optionPairsToRecord(pairs: VariantFormValues['optionPairs']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const k = pair.optKey.trim();
    const val = pair.optValue.trim();
    if (!k || !val) continue;
    out[k] = val;
  }
  return out;
}

function optionRecordEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function validateCatalogPriceRows(rows: CatalogPriceRow[]): string | null {
  let validRows = 0;
  for (const row of rows) {
    const u = Number(row.unitId);
    const c = Number(row.currentValue);
    const refRaw = row.referencePrice.trim();
    const refNum = refRaw === '' ? 0 : Number(row.referencePrice);
    if (!Number.isFinite(u) || u <= 0) continue;
    if (!Number.isFinite(c) || c < 0) {
      return 'Giá bán hiện tại phải là số ≥ 0.';
    }
    if (refRaw !== '' && (!Number.isFinite(refNum) || refNum < 0)) {
      return 'Giá tham chiếu phải là số ≥ 0.';
    }
    validRows++;
  }
  if (validRows === 0) {
    return 'Cần ít nhất một dòng có đơn vị và giá hợp lệ.';
  }
  return null;
}

function validateVariantsSection(values: FormValues, requireSkuCodes: boolean): string | null {
  if (!values.variants?.length) {
    return 'Cần ít nhất một phân loại sản phẩm.';
  }
  for (let i = 0; i < values.variants.length; i++) {
    const v = values.variants[i];
    if (requireSkuCodes && !v.skuCode.trim()) {
      return `Phân loại #${i + 1}: cần mã skuCode (chuỗi, ví dụ mã nhập kho).`;
    }
    const pv = validateCatalogPriceRows(v.prices);
    if (pv) return `Phân loại #${i + 1}: ${pv}`;
  }
  return null;
}

/** Ánh xạ thông báo `validateEditProductForm` sang RHF để hiển thị inline và focus trường tương ứng. */
function applyProductFormValidationFeedback(
  setError: UseFormSetError<FormValues>,
  setFocus: UseFormSetFocus<FormValues>,
  message: string
): { fieldMapped: boolean } {
  if (/^Không được để trống tên/.test(message.trim())) {
    setError('productName', { type: 'manual', message });
    void setFocus('productName');
    return { fieldMapped: true };
  }
  if (/Hãy chọn danh mục/.test(message)) {
    setError('categoryId', { type: 'manual', message });
    void setFocus('categoryId');
    return { fieldMapped: true };
  }
  if (/Hãy chọn hãng hợp lệ hoặc để trống/.test(message)) {
    setError('brandId', { type: 'manual', message });
    void setFocus('brandId');
    return { fieldMapped: true };
  }
  if (/SKU phải là số nguyên dương/.test(message)) {
    setError('sku', { type: 'manual', message });
    void setFocus('sku');
    return { fieldMapped: true };
  }
  const variantLine = /^Phân loại #(\d+): (.+)$/.exec(message);
  if (variantLine) {
    const idx = Number(variantLine[1]) - 1;
    const rest = variantLine[2].trim();
    if (/cần mã skuCode/i.test(rest)) {
      setError(`variants.${idx}.skuCode`, { type: 'manual', message: rest });
      void setFocus(`variants.${idx}.skuCode`);
      return { fieldMapped: true };
    }
    const priceFocus = `variants.${idx}.prices.0.currentValue` as Path<FormValues>;
    setError(priceFocus, { type: 'manual', message: rest });
    void setFocus(priceFocus);
    return { fieldMapped: true };
  }
  return { fieldMapped: false };
}

/** Snapshot khi load SP — khớp PUT `updatedVariants` / `removedVariantIds`. */
type VariantInitialSnapshot = {
  id: number;
  skuCode: string;
  active: boolean;
  sortOrder: number;
  optionValues: Record<string, string>;
  prices: ProductPrice[];
  /** Ảnh/document thuộc SKU (`GET variants[].documents` khi có) — @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4 */
  documents: ProductDocumentSummary[];
  /** `effective_unit_price` — đơn giá khách sau PC (snapshot API). */
  effectiveUnitPrice?: number | null;
  /** PC đang gắn SKU trong response (null = không có). */
  activePriceChange?: ProductPriceChange | null;
};

type VariantSkuMainPick =
  | { kind: 'inherit' }
  | { kind: 'document'; documentId: number }
  | { kind: 'pendingFile'; fileIndex: number };

type VariantSkuGalleryDraft = {
  removedDocumentIds: number[];
  pendingFiles: File[] | null;
  pendingMainFileIndex: number;
  mainPick: VariantSkuMainPick;
};

const VARIANT_SKU_GALLERY_EMPTY: VariantSkuGalleryDraft = {
  removedDocumentIds: [],
  pendingFiles: null,
  pendingMainFileIndex: 0,
  mainPick: { kind: 'inherit' },
};

function variantSkuGalleryHasPendingEdits(
  draft: VariantSkuGalleryDraft,
  snap: VariantInitialSnapshot
): boolean {
  if (draft.removedDocumentIds.length > 0) return true;
  if (draft.pendingFiles != null && draft.pendingFiles.length > 0) return true;
  const serverMain =
    productDocumentsToServerMediumItems(snap.documents).find(
      (i) => i.documentId != null && i.coverEligible && i.isMainCover
    )?.documentId ?? null;
  if (draft.mainPick.kind === 'pendingFile') return true;
  if (draft.mainPick.kind === 'document' && draft.mainPick.documentId !== serverMain) return true;
  return false;
}

/**
 * PUT `updatedVariants[]` — `removedDocumentIds` / `mainDocumentId` cho ảnh SKU (document cấp variant).
 * Ảnh mới chỉ gửi qua POST `…/variants/{id}/images` (xử lý sau PUT trong form).
 * @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4.2
 */
function mergeVariantSkuGalleryIntoUpdatedVariants(
  formRows: VariantFormValues[],
  initialSnaps: VariantInitialSnapshot[],
  galleryById: Record<number, VariantSkuGalleryDraft>,
  baseList: UpdateProductVariantItemRequest[]
): UpdateProductVariantItemRequest[] {
  const snapById = new Map(initialSnaps.map((s) => [s.id, s]));
  const byId = new Map<number, UpdateProductVariantItemRequest>();
  for (const u of baseList) byId.set(u.id, { ...u });

  for (const row of formRows) {
    const rawVid = row.variantId?.trim();
    if (!rawVid) continue;
    const vid = Number(rawVid);
    if (!Number.isFinite(vid) || vid <= 0) continue;
    const g = galleryById[vid];
    if (!g) continue;
    const snap = snapById.get(vid);
    if (!snap) continue;

    const items = productDocumentsToServerMediumItems(snap.documents);
    const serverMain =
      items.find((i) => i.documentId != null && i.coverEligible && i.isMainCover)?.documentId ?? null;

    const hasRemoved = g.removedDocumentIds.length > 0;
    let mainDirty = false;
    let chosenMainDocId: number | undefined;

    if (g.mainPick.kind === 'document') {
      chosenMainDocId = g.mainPick.documentId;
      mainDirty = chosenMainDocId !== serverMain;
    }

    if (!hasRemoved && !mainDirty) continue;

    let uv = byId.get(vid);
    if (!uv) {
      uv = { id: vid };
      byId.set(vid, uv);
    }
    if (hasRemoved) uv.removedDocumentIds = [...g.removedDocumentIds];
    if (mainDirty && chosenMainDocId !== undefined) uv.mainDocumentId = chosenMainDocId;
  }

  return [...byId.values()];
}

/** `unitId` rỗng → UnitSelect chỉnh theo đơn vị đầu trong GET `/admin/units` (đừng cứng `1` — id phụ thuộc tenant). */
function emptyCatalogPriceRow(defaultUnitId = ''): CatalogPriceRow {
  return { unitId: defaultUnitId, currentValue: '0', referencePrice: '0' };
}

function emptyVariantFormRow(sortIndex: number, defaultUnitId = ''): VariantFormValues {
  return {
    variantId: '',
    skuCode: '',
    active: true,
    sortOrder: String(sortIndex),
    optionPairs: [{ optKey: '', optValue: '' }],
    prices: [emptyCatalogPriceRow(defaultUnitId)],
  };
}

function coerceProductPrice(raw: unknown): ProductPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = Number(r.id);
  const unitId = Number(r.unitId ?? r.unit_id);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(unitId) || unitId <= 0) return null;
  const currentValue = Number(r.currentValue ?? r.current_value);
  const oldRaw = r.oldValue ?? r.old_value;
  const oldValue =
    oldRaw === null || oldRaw === undefined ? null : Number(oldRaw);
  const unitName = typeof r.unitName === 'string' ? r.unitName : typeof r.unit_name === 'string' ? r.unit_name : '';
  const unitRatio = Number(r.unitRatio ?? r.unit_ratio ?? 1) || 1;
  let productVariantId: number | undefined;
  const pvRaw = r.productVariantId ?? r.product_variant_id;
  if (pvRaw != null && pvRaw !== '') {
    const pvn = Number(pvRaw);
    if (Number.isFinite(pvn) && pvn > 0) productVariantId = pvn;
  }
  return {
    id,
    currentValue: Number.isFinite(currentValue) ? currentValue : 0,
    oldValue:
      oldValue != null && Number.isFinite(oldValue) ? oldValue : null,
    unitId,
    unitName,
    unitRatio,
    ...(productVariantId != null ? { productVariantId } : {}),
  };
}

function readFiniteNumberOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** `active_price_change` / `activePriceChange` trên variant — snapshot PC. */
function coerceActivePriceChange(raw: unknown): ProductPriceChange | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = Number(r.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const basePrice = Number(r.basePrice ?? r.base_price);
  if (!Number.isFinite(basePrice)) return null;
  const saleRaw = r.salePrice ?? r.sale_price;
  const salePrice =
    saleRaw === null || saleRaw === undefined || saleRaw === ''
      ? null
      : Number(saleRaw);
  const startRaw = r.startAt ?? r.start_at;
  const startAt = typeof startRaw === 'string' ? startRaw : startRaw != null ? String(startRaw) : '';
  if (!startAt.trim()) return null;
  const endRaw = r.endAt ?? r.end_at;
  const endAt =
    endRaw === null || endRaw === undefined
      ? null
      : typeof endRaw === 'string'
        ? endRaw
        : String(endRaw);
  const productIdRaw = r.productId ?? r.product_id;
  const productId =
    productIdRaw != null && productIdRaw !== ''
      ? Number(productIdRaw)
      : NaN;
  const pvRaw = r.productVariantId ?? r.product_variant_id;
  let productVariantId: number | null | undefined;
  if (pvRaw != null && pvRaw !== '') {
    const pv = Number(pvRaw);
    if (Number.isFinite(pv) && pv > 0) productVariantId = pv;
  }
  const enabled = r.enabled !== false && r.enabled !== 0 && r.enabled !== 'false';
  return {
    id,
    productId: Number.isFinite(productId) && productId > 0 ? Math.trunc(productId) : 0,
    basePrice,
    salePrice: salePrice != null && Number.isFinite(salePrice) ? salePrice : null,
    startAt,
    endAt: endAt && endAt.trim() ? endAt : null,
    enabled: Boolean(enabled),
    ...(productVariantId != null ? { productVariantId } : {}),
  };
}

function coerceVolumePriceTiersFromUnknown(raw: unknown): VolumePriceTier[] {
  if (!Array.isArray(raw)) return [];
  const out: VolumePriceTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id);
    const minQ = Number(o.minQuantity ?? o.min_quantity);
    const unitP = Number(o.unitPrice ?? o.unit_price);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(minQ)) continue;
    if (!Number.isFinite(unitP)) continue;
    const enabled = o.enabled !== false && o.enabled !== 0 && o.enabled !== 'false';
    const pidRaw = o.productId ?? o.product_id;
    const productId = pidRaw != null ? Number(pidRaw) : undefined;
    out.push({
      id,
      minQuantity: minQ,
      unitPrice: unitP,
      enabled: Boolean(enabled),
      ...(productId != null && Number.isFinite(productId) && productId > 0 ? { productId: Math.trunc(productId) } : {}),
    });
  }
  return out;
}

function coercePwpProgramsFromUnknown(raw: unknown): PurchaseWithPurchaseProgram[] {
  if (!Array.isArray(raw)) return [];
  const out: PurchaseWithPurchaseProgram[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id);
    const roleRaw = String(o.role ?? '').trim();
    if (!Number.isFinite(id) || id <= 0) continue;
    if (roleRaw !== 'companion' && roleRaw !== 'anchor') continue;
    const enabled = o.enabled !== false && o.enabled !== 0 && o.enabled !== 'false';
    const anchorProductId = readFiniteNumberOrNull(o.anchorProductId, o.anchor_product_id);
    const companionProductId = readFiniteNumberOrNull(o.companionProductId, o.companion_product_id);
    const promoUnitPrice = readFiniteNumberOrNull(o.promoUnitPrice, o.promo_unit_price);
    const minAnchorQuantity = readFiniteNumberOrNull(o.minAnchorQuantity, o.min_anchor_quantity);
    const companionPromoUnitsPerAnchor = readFiniteNumberOrNull(
      o.companionPromoUnitsPerAnchor,
      o.companion_promo_units_per_anchor
    );
    const anchorVariantId = readFiniteNumberOrNull(o.anchorVariantId, o.anchor_variant_id);
    const companionVariantId = readFiniteNumberOrNull(o.companionVariantId, o.companion_variant_id);
    const maxRaw = o.maxCompanionPromoUnits ?? o.max_companion_promo_units;
    const maxCompanionPromoUnits =
      maxRaw === null || maxRaw === undefined ? null : Number(maxRaw);
    out.push({
      id,
      role: roleRaw,
      enabled: Boolean(enabled),
      ...(anchorVariantId != null ? { anchorVariantId: Math.trunc(anchorVariantId) } : {}),
      ...(companionVariantId != null ? { companionVariantId: Math.trunc(companionVariantId) } : {}),
      ...(anchorProductId != null ? { anchorProductId: Math.trunc(anchorProductId) } : {}),
      ...(companionProductId != null ? { companionProductId: Math.trunc(companionProductId) } : {}),
      ...(promoUnitPrice != null ? { promoUnitPrice } : {}),
      ...(minAnchorQuantity != null ? { minAnchorQuantity: Math.trunc(minAnchorQuantity) } : {}),
      ...(companionPromoUnitsPerAnchor != null
        ? { companionPromoUnitsPerAnchor: Math.trunc(companionPromoUnitsPerAnchor) }
        : {}),
      ...(maxCompanionPromoUnits != null && Number.isFinite(maxCompanionPromoUnits)
        ? { maxCompanionPromoUnits }
        : {}),
    });
  }
  return out;
}

function coerceVariantRowsFromProduct(p: ProductFullResponse): {
  snaps: VariantInitialSnapshot[];
} | null {
  const raw = (p as { variants?: unknown }).variants;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const snaps: VariantInitialSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id ?? o.variantId ?? o.variant_id ?? o.variantID);
    if (!Number.isFinite(id) || id <= 0) continue;
    const skuCode = String(o.skuCode ?? o.sku_code ?? '').trim();
    const active = o.active !== false && o.active !== 0 && o.active !== 'false';
    const sortOrder =
      typeof o.sortOrder === 'number'
        ? o.sortOrder
        : typeof o.sort_order === 'number'
          ? o.sort_order
          : Number(o.sortOrder ?? o.sort_order ?? 0) || 0;
    let optionValues: Record<string, string> = {};
    const ovRaw = o.optionValues ?? o.option_values;
    if (ovRaw && typeof ovRaw === 'object') {
      for (const [k, val] of Object.entries(ovRaw as Record<string, unknown>)) {
        if (!String(k).trim()) continue;
        if (val === null || val === undefined) continue;
        optionValues[String(k)] = typeof val === 'string' ? val : String(val);
      }
    }
    let pricesList: unknown = o.prices;
    const prices: ProductPrice[] = Array.isArray(pricesList)
      ? pricesList.map(coerceProductPrice).filter((x): x is ProductPrice => x != null)
      : [];
    const documents = parseVariantDocumentsFromApiObject(o);
    const effectiveUnitPrice = readFiniteNumberOrNull(o.effectiveUnitPrice, o.effective_unit_price);
    const activePriceChange = coerceActivePriceChange(o.activePriceChange ?? o.active_price_change);
    snaps.push({
      id,
      skuCode,
      active: Boolean(active),
      sortOrder,
      optionValues,
      prices,
      documents,
      ...(effectiveUnitPrice != null ? { effectiveUnitPrice } : {}),
      activePriceChange,
    });
  }
  if (snaps.length === 0) return null;
  snaps.sort((a, b) => a.sortOrder - b.sortOrder);
  return { snaps };
}

/**
 * Một số bản GET admin trả `prices[]` với `product_variant_id` nhưng không hydrate `variants[]`.
 * Không có branch này, FE vào nhánh legacy `newPrices`/`updatedPrices` ở gốc → BE báo «Product has no variants».
 */
function inferVariantSnapshotsFromRootPrices(
  product: ProductFullResponse | null | undefined
): VariantInitialSnapshot[] | null {
  if (!product) return null;
  const raw = product.prices;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const byVid = new Map<number, ProductPrice[]>();
  for (const row of raw) {
    const price = coerceProductPrice(row);
    if (!price?.productVariantId || !Number.isFinite(price.productVariantId) || price.productVariantId <= 0) continue;
    const vid = price.productVariantId;
    const list = byVid.get(vid) ?? [];
    list.push(price);
    byVid.set(vid, list);
  }

  if (byVid.size === 0) return null;

  const snaps: VariantInitialSnapshot[] = [...byVid.entries()]
    .sort(([a], [b]) => a - b)
    .map(([vid, plist], idx) => ({
      id: vid,
      skuCode: '',
      active: true,
      sortOrder: idx,
      optionValues: {},
      prices: plist.map((r) => ({ ...r })),
      documents: [],
    }));

  return snaps.length > 0 ? snaps : null;
}

/** Ưu tiên `variants[]` từ API; fallback gom SKU từ `prices[].product_variant_id`. */
function deriveVariantSnapshotsForAdminEdit(
  product: ProductFullResponse | null | undefined
): VariantInitialSnapshot[] | null {
  if (!product) return null;
  const direct = coerceVariantRowsFromProduct(product);
  if (direct?.snaps?.length) return direct.snaps;
  return inferVariantSnapshotsFromRootPrices(product);
}

function variantSnapsToFormValues(
  snaps: VariantInitialSnapshot[],
  fallbackCatalogUnitId = ''
): VariantFormValues[] {
  return snaps.map((snap) => {
    const pairs = Object.entries(snap.optionValues).map(([optKey, optValue]) => ({ optKey, optValue }));
    const optionPairs = pairs.length > 0 ? pairs : [{ optKey: '', optValue: '' }];
    const priceRows =
      snap.prices.length > 0
        ? snap.prices.map((row) => ({
          priceId: String(row.id),
          unitId: String(row.unitId),
          currentValue: String(row.currentValue),
          referencePrice: String(row.oldValue ?? 0),
        }))
        : [emptyCatalogPriceRow(fallbackCatalogUnitId)];
    return {
      variantId: String(snap.id),
      skuCode: snap.skuCode,
      active: snap.active,
      sortOrder: String(snap.sortOrder),
      optionPairs,
      prices: priceRows,
    };
  });
}

function attachProductIdToCreatePriceRequests(
  rows: CreatePriceRequest[],
  productId: number | undefined
): CreatePriceRequest[] {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) return rows;
  const pid = Math.trunc(id);
  return rows.map((r) => ({ ...r, product_id: pid }));
}

/** `PUT /admin/products/{id}` — `removedPriceIds` / `updatedPrices` / `newPrices`. */
function buildCatalogPriceUpdatePayload(
  rows: CatalogPriceRow[],
  initial: ProductPrice[] | null | undefined,
  productId?: number
): {
  removedPriceIds: number[];
  updatedPrices: UpdateProductPriceItemRequest[];
  newPrices: CreatePriceRequest[];
} {
  const initialList = initial ?? [];
  const initialMap = new Map(initialList.map((p) => [p.id, p]));

  const existingIdsInForm = new Set<number>();
  for (const row of rows) {
    const rid = row.priceId?.trim();
    if (!rid) continue;
    const id = Number(rid);
    if (Number.isFinite(id) && id > 0) existingIdsInForm.add(id);
  }

  const removedPriceIds = initialList.map((p) => p.id).filter((id) => !existingIdsInForm.has(id));

  const updatedPrices: UpdateProductPriceItemRequest[] = [];
  for (const row of rows) {
    const rid = row.priceId?.trim();
    if (!rid) continue;
    const id = Number(rid);
    if (!Number.isFinite(id) || id <= 0) continue;
    const orig = initialMap.get(id);
    if (!orig) continue;

    const unitId = Number(row.unitId);
    const current_value = Number(row.currentValue);
    const refRaw = row.referencePrice.trim();
    const oldVal = refRaw === '' ? 0 : Number(row.referencePrice);

    if (!Number.isFinite(unitId) || unitId <= 0) continue;
    if (!Number.isFinite(current_value) || current_value < 0) continue;

    const origOld = orig.oldValue ?? 0;
    const changed =
      unitId !== orig.unitId || current_value !== orig.currentValue || oldVal !== origOld;

    if (!changed) continue;

    const item: UpdateProductPriceItemRequest = { id, current_value };
    if (unitId !== orig.unitId) item.unit_id = unitId;
    // Chỉ gửi old_value khi là số dương; không gửi 0 / trống để tránh ghi đè
    // thành ~~₫0~~ trên storefront. Nếu origOld > 0 và user xóa trắng → field bị bỏ qua,
    // BE giữ giá trị cũ (theo spec "Không gửi → giữ old_value trên DB").
    if (oldVal !== origOld) {
      if (Number.isFinite(oldVal) && oldVal > 0) item.old_value = oldVal;
    }
    updatedPrices.push(item);
  }

  const newPrices: CreatePriceRequest[] = [];
  for (const row of rows) {
    if (row.priceId?.trim()) continue;

    const unit_id = Number(row.unitId);
    const current_value = Number(row.currentValue);
    const refRaw = row.referencePrice.trim();
    const oldNum = refRaw === '' ? 0 : Number(row.referencePrice);

    if (!Number.isFinite(unit_id) || unit_id <= 0) continue;
    if (!Number.isFinite(current_value) || current_value < 0) continue;

    const np: CreatePriceRequest = { unit_id, current_value };
    if (refRaw !== '' && Number.isFinite(oldNum) && oldNum > 0) np.old_value = oldNum;
    newPrices.push(np);
  }

  return {
    removedPriceIds,
    updatedPrices,
    newPrices: attachProductIdToCreatePriceRequests(newPrices, productId),
  };
}

function rowsToCreatePriceRequests(
  rows: CatalogPriceRow[],
  productId?: number
): CreatePriceRequest[] {
  const out: CreatePriceRequest[] = [];
  for (const row of rows) {
    const unit_id = Number(row.unitId);
    const current_value = Number(row.currentValue);
    const refRaw = row.referencePrice.trim();
    const oldNum = refRaw === '' ? 0 : Number(row.referencePrice);
    if (!Number.isFinite(unit_id) || unit_id <= 0) continue;
    if (!Number.isFinite(current_value) || current_value < 0) continue;
    const np: CreatePriceRequest = { unit_id, current_value };
    if (refRaw !== '' && Number.isFinite(oldNum) && oldNum > 0) np.old_value = oldNum;
    const id = Number(productId);
    if (Number.isFinite(id) && id > 0) np.product_id = Math.trunc(id);
    out.push(np);
  }
  return out;
}

function buildMultiVariantUpdatePayload(
  rows: VariantFormValues[],
  initial: VariantInitialSnapshot[],
  productId: number
): {
  removedVariantIds: number[];
  newVariants: CreateProductVariantRequest[];
  updatedVariants: UpdateProductVariantItemRequest[];
} {
  const initialById = new Map(initial.map((s) => [s.id, s]));
  const formIds = new Set(
    rows
      .map((r) => r.variantId?.trim())
      .filter(Boolean)
      .map(Number)
      .filter((id) => id > 0)
  );
  const removedVariantIds = initial.map((s) => s.id).filter((id) => !formIds.has(id));

  const newVariants: CreateProductVariantRequest[] = [];
  const updatedVariants: UpdateProductVariantItemRequest[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const optionValues = optionPairsToRecord(row.optionPairs);
    const sortOrderNum = Number(row.sortOrder.trim());
    const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : i;

    const rawVid = row.variantId?.trim();
    if (!rawVid) {
      const nvPrices = rowsToCreatePriceRequests(row.prices, productId);
      newVariants.push({
        skuCode: row.skuCode.trim(),
        optionValues,
        active: Boolean(row.active),
        sortOrder,
        ...(nvPrices.length > 0 ? { prices: nvPrices } : {}),
      });
      continue;
    }

    const id = Number(rawVid);
    if (!Number.isFinite(id) || id <= 0) continue;
    const snap = initialById.get(id);
    if (!snap) continue;

    const pd = buildCatalogPriceUpdatePayload(row.prices, snap.prices, productId);

    const metaDirty =
      row.skuCode.trim() !== snap.skuCode ||
      Boolean(row.active) !== snap.active ||
      sortOrder !== snap.sortOrder ||
      !optionRecordEqual(optionValues, snap.optionValues);

    const priceDirty =
      pd.removedPriceIds.length > 0 || pd.updatedPrices.length > 0 || pd.newPrices.length > 0;

    if (!metaDirty && !priceDirty) continue;

    const uv: UpdateProductVariantItemRequest = { id };
    if (metaDirty) {
      uv.skuCode = row.skuCode.trim();
      uv.optionValues = optionValues;
      uv.active = Boolean(row.active);
      uv.sortOrder = sortOrder;
    }
    if (priceDirty) {
      if (pd.removedPriceIds.length > 0) uv.removedPriceIds = pd.removedPriceIds;
      if (pd.updatedPrices.length > 0) uv.updatedPrices = pd.updatedPrices;
      if (pd.newPrices.length > 0) uv.newPrices = pd.newPrices;
    }
    updatedVariants.push(uv);
  }

  return { removedVariantIds, newVariants, updatedVariants };
}

type VariantSkuGalleryPanelProps = {
  variantNumericId: number;
  snapshot: VariantInitialSnapshot;
  draft: VariantSkuGalleryDraft;
  disabled?: boolean;
  onDraftPatch: (patch: Partial<VariantSkuGalleryDraft>) => void;
  fieldIdPrefix: string;
};

function VariantSkuGalleryPanel({
  variantNumericId,
  snapshot,
  draft,
  disabled,
  onDraftPatch,
  fieldIdPrefix,
}: VariantSkuGalleryPanelProps) {
  const pickInputId = `${fieldIdPrefix}-sku-new-images`;

  const serverItems = useMemo(
    () => productDocumentsToServerMediumItems(snapshot.documents),
    [snapshot.documents]
  );

  const visibleServerItems = useMemo(() => {
    const rm = new Set(draft.removedDocumentIds);
    return serverItems.filter((it) => it.documentId == null || !rm.has(it.documentId));
  }, [serverItems, draft.removedDocumentIds]);

  const pendingPreviews = useMemo(() => {
    const fs = draft.pendingFiles;
    if (!fs?.length) return [];
    return fs.map((f) => URL.createObjectURL(f));
  }, [draft.pendingFiles]);

  useEffect(() => {
    return () => pendingPreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingPreviews]);

  const markDocRemove = useCallback(
    (documentId: number) => {
      onDraftPatch({
        removedDocumentIds:
          draft.removedDocumentIds.includes(documentId)
            ? draft.removedDocumentIds
            : [...draft.removedDocumentIds, documentId],
        mainPick:
          draft.mainPick.kind === 'document' && draft.mainPick.documentId === documentId
            ? { kind: 'inherit' }
            : draft.mainPick,
      });
    },
    [draft.removedDocumentIds, draft.mainPick, onDraftPatch]
  );

  const onFileInputChange = useCallback(
    (list: FileList | null) => {
      const arr = list?.length ? Array.from(list).filter((f) => f.type.startsWith('image/')) : [];
      if (!arr.length) {
        notify.error('Chỉ chấp nhận file ảnh.');
        return;
      }
      const mainIx = firstImageFileIndex(arr) ?? 0;
      const nextPick: VariantSkuMainPick =
        draft.mainPick.kind === 'document' ? draft.mainPick : { kind: 'inherit' };
      onDraftPatch({
        pendingFiles: arr,
        pendingMainFileIndex: mainIx,
        mainPick: nextPick,
      });
      notify.info('Ảnh đã được thêm vào hàng chờ. Nhấn «Lưu sản phẩm» để tải lên.', {
        duration: 4800,
      });
    },
    [draft.mainPick, onDraftPatch]
  );

  const clearPendingUpload = useCallback(() => {
    onDraftPatch({
      pendingFiles: null,
      pendingMainFileIndex: 0,
      mainPick: draft.mainPick.kind === 'pendingFile' ? { kind: 'inherit' } : draft.mainPick,
    });
  }, [draft.mainPick, onDraftPatch]);

  const normalizedPendingMainIx = normalizeVariantMultipartMainImageIndex(
    draft.pendingFiles ?? [],
    draft.pendingMainFileIndex
  );

  return (
    <div className="mt-4 rounded-lg border border-[var(--bg-border)]/80 bg-[var(--bg-elevated)]/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bg-border)]/70 pb-2">
        <div>
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">
            Gallery ảnh phân loại{' '}
            <span className="tabular-nums text-[var(--text-secondary)]">(ID {variantNumericId})</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={pickInputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              onFileInputChange(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => document.getElementById(pickInputId)?.click()}
            className={clsx(
              'inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5',
              'text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <ImagePlus className="size-3.5 shrink-0" aria-hidden />
            Thêm ảnh
          </button>
          {draft.pendingFiles?.length ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => clearPendingUpload()}
              className="text-[11px] font-semibold text-[var(--danger)] hover:underline disabled:opacity-50"
            >
              Huỷ lô chờ
            </button>
          ) : null}
        </div>
      </div>

      {(visibleServerItems.length > 0 || (draft.pendingFiles?.length ?? 0) > 0) ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
          {visibleServerItems.map((item) => {
            if (item.documentId == null || !galleryImageSrc(item)) return null;
            const src = galleryImageSrc(item)!;
            const isMain =
              draft.mainPick.kind === 'document'
                ? draft.mainPick.documentId === item.documentId
                : draft.mainPick.kind === 'inherit' && !(draft.pendingFiles?.length ?? 0) && item.isMainCover;
            return (
              <li
                key={item.key}
                className={clsx(
                  'relative overflow-hidden rounded-lg border border-[var(--bg-border)] bg-black/10',
                  isMain ? 'ring-2 ring-[var(--accent)]/70' : ''
                )}
              >
                <div className="relative flex h-[5.75rem] w-full items-center justify-center">
                  <img alt="" src={src} className="max-h-full max-w-full object-contain p-2" loading="lazy" />
                </div>
                {item.coverEligible && item.documentId != null ? (
                  <button
                    type="button"
                    aria-label={`Đặt đại diện — ${item.title}`}
                    disabled={disabled}
                    onClick={() => {
                      const docId = item.documentId;
                      if (docId == null) return;
                      onDraftPatch({ mainPick: { kind: 'document', documentId: docId } });
                    }}
                    className={clsx(
                      'absolute left-1.5 bottom-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px]',
                      'font-semibold backdrop-blur-sm',
                      isMain
                        ? 'bg-[var(--accent)] text-black'
                        : 'bg-black/60 text-[var(--text-primary)] hover:bg-black/85'
                    )}
                  >
                    <Star className="me-0.5 size-3 shrink-0" aria-hidden /> Đại diện
                  </button>
                ) : null}
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={`Xóa ảnh khỏi SKU — ${item.title}`}
                    onClick={() => item.documentId != null && markDocRemove(item.documentId)}
                    className={clsx(
                      'absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/70',
                      'text-white shadow hover:bg-[var(--danger)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    )}
                  >
                    <X className="size-3.5 shrink-0" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}

          {draft.pendingFiles?.map((_, i) => {
            const src = pendingPreviews[i];
            if (!src) return null;
            const isMain =
              draft.mainPick.kind === 'pendingFile'
                ? draft.mainPick.fileIndex === i
                : draft.mainPick.kind === 'inherit' && normalizedPendingMainIx === i;
            return (
              <li
                key={`pend-${variantNumericId}-${i}`}
                className={clsx(
                  'relative overflow-hidden rounded-lg border border-dashed border-[var(--accent)]/45 bg-black/12',
                  isMain ? 'ring-2 ring-[var(--accent)]/65' : ''
                )}
              >
                <div className="relative flex h-[5.75rem] w-full items-center justify-center">
                  <img alt="" src={src} className="max-h-full max-w-full object-contain p-2" />
                </div>
                <span className="absolute left-1.5 top-1.5 rounded bg-black/72 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Chưa gửi
                </span>
                <button
                  type="button"
                  aria-label={`Đặt đại diện — ảnh mới #${i + 1}`}
                  disabled={disabled}
                  onClick={() =>
                    onDraftPatch({
                      mainPick: { kind: 'pendingFile', fileIndex: i },
                      pendingMainFileIndex: i,
                    })
                  }
                  className={clsx(
                    'absolute left-1.5 bottom-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px]',
                    'font-semibold backdrop-blur-sm',
                    isMain
                      ? 'bg-[var(--accent)] text-black'
                      : 'bg-black/60 text-[var(--text-primary)] hover:bg-black/85'
                  )}
                >
                  <Star className="me-0.5 size-3 shrink-0" aria-hidden /> Đại diện
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type VariantSkuCardProps = {
  index: number;
  control: Control<FormValues>;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  removeVariant: (index: number) => void;
  variantCount: number;
  defaultCatalogUnitStr: string;
  requireSkuCode: boolean;
  fieldIdPrefix: string;
  nestedErrors?: FieldErrors<VariantFormValues>;
  inputCls: string;
  priceRowLabelCls: string;
  priceRowControlCls: string;
  invalidOutlineCls: string;
  skuMediaFooter?: ReactNode;
  /** Snapshot giá khách / PC từ GET — chỉ khi sửa SP đã có SKU. */
  guestPriceInsight?: {
    effectiveUnitPrice: number | null;
    activePriceChange: ProductPriceChange | null;
    /** `product_variant_id` — đặt hàng / PC bám theo id này. */
    variantDbId: number;
  } | null;
  /** Khi sửa SP đã có SKU: id biến thể trong DB; tạo mới thì null. */
  persistedDbVariantId: number | null;
};

function formatInsightIsoVi(iso: string | null | undefined): string {
  if (!iso) return '∞';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

/** Nhãn chip giảm giá: số tiền; thêm % khi gần số nguyên. */
function formatActivePriceChangeSavingsChip(basePrice: number, salePrice: number): string | null {
  if (!Number.isFinite(basePrice) || !Number.isFinite(salePrice) || salePrice >= basePrice) return null;
  const off = Math.round(basePrice - salePrice);
  if (off <= 0) return null;
  const pctRaw = (off / basePrice) * 100;
  const pctRounded = Math.round(pctRaw);
  const money = `−${formatIntegerViVN(off)} ₫`;
  const pctPart =
    pctRounded > 0 && pctRounded < 100 && Math.abs(pctRaw - pctRounded) < 0.51 ? ` (−${pctRounded}%)` : '';
  return `${money}${pctPart}`;
}

/** Giai đoạn PC trên snapshot GET: none = không hiển thị khung chương trình. */
type GuestPricePromoPhase = 'none' | 'upcoming' | 'active';

function parseInsightIsoToMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function resolveGuestPricePromoPhase(pc: ProductPriceChange | null, nowMs: number): GuestPricePromoPhase {
  if (!pc || pc.enabled === false) return 'none';
  const startMs = parseInsightIsoToMs(pc.startAt);
  if (startMs == null) return 'none';
  if (nowMs < startMs) return 'upcoming';
  const endMs = pc.endAt?.trim() ? parseInsightIsoToMs(pc.endAt) : null;
  if (endMs != null && nowMs > endMs) return 'none';
  return 'active';
}

function GuestStorefrontPriceReconciliation({
  effectiveUnitPrice,
  activePriceChange,
  variantDbId,
}: {
  effectiveUnitPrice: number | null;
  activePriceChange: ProductPriceChange | null;
  variantDbId: number;
}) {
  const [nowMs, setNowMs] = useState(() => (typeof window !== 'undefined' ? Date.now() : 0));
  useLayoutEffect(() => {
    setNowMs(Date.now());
  }, [
    activePriceChange?.id,
    activePriceChange?.startAt,
    activePriceChange?.endAt,
    activePriceChange?.enabled,
  ]);
  const phase = resolveGuestPricePromoPhase(activePriceChange, nowMs);
  const pc = activePriceChange;
  const saleFromPc =
    pc && pc.enabled
      ? pc.salePrice != null && Number.isFinite(pc.salePrice)
        ? pc.salePrice
        : pc.basePrice
      : null;
  const baseFromPc = pc && pc.enabled ? pc.basePrice : null;
  const hasStructDisc =
    phase === 'active' &&
    saleFromPc != null &&
    baseFromPc != null &&
    Number.isFinite(baseFromPc) &&
    saleFromPc < baseFromPc;
  const displaySale = effectiveUnitPrice ?? (hasStructDisc ? saleFromPc : effectiveUnitPrice);
  const displayBase = hasStructDisc && baseFromPc != null ? baseFromPc : null;
  const savingsChip =
    hasStructDisc && displayBase != null && saleFromPc != null
      ? formatActivePriceChangeSavingsChip(displayBase, saleFromPc)
      : null;

  const effectivePriceDd =
    hasStructDisc && displaySale != null && displayBase != null ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
          {formatPrice(displaySale)}
        </span>
        <span className="text-[15px] text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/80">
          {formatPrice(displayBase)}
        </span>
        {savingsChip ? (
          <span
            className="inline-flex items-center rounded-md border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-2 py-0.5 text-xs font-bold text-[var(--danger)]"
            title="Mức giảm so với giá gốc chương trình"
          >
            {savingsChip}
          </span>
        ) : null}
      </div>
    ) : effectiveUnitPrice != null ? (
      <span className="font-[family-name:var(--font-admin-mono)] text-lg font-semibold text-[var(--text-primary)]">
        {formatPrice(effectiveUnitPrice)}
      </span>
    ) : (
      <span>—</span>
    );

  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--accent)]/40 bg-[var(--accent-soft)]/25 p-3">
      <p className="mb-1 text-base font-semibold text-[var(--text-primary)]">
        Giá khách & Price change (theo phân loại này)
      </p>
      <p className="mb-2 text-[11px] leading-snug text-[var(--text-muted)]">
        Giá hiệu lực và đợt giảm giá đang áp dụng gắn với phân loại #{variantDbId}.
        Đơn hàng được xử lý theo mã phân loại này, không theo mã SKU hiển thị.
      </p>
      <dl className="space-y-3 text-[15px] text-[var(--text-secondary)]">
        <div>
          <dt className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--text-muted)]">
            <span>Giá hiệu lực hiện tại</span>
            {phase === 'none' ? (
              <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] ring-1 ring-[var(--bg-border)]">
                Giá thông thường
              </span>
            ) : null}
          </dt>
          <dd className="mt-1.5">{effectivePriceDd}</dd>
        </div>
        {phase === 'active' || phase === 'upcoming' ? (
          <div>
            <dt className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--text-muted)]">
              <span>Chương trình giảm giá (Price change — theo SKU)</span>
              {phase === 'active' ? (
                <span className="inline-flex items-center rounded-full bg-[color:var(--success)]/18 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--success)] ring-1 ring-[color:var(--success)]/35">
                  Đang áp dụng
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-500/40 dark:bg-amber-400/12 dark:text-amber-200 dark:ring-amber-400/35">
                  Sắp diễn ra
                </span>
              )}
            </dt>
            <dd className="mt-1.5">
              {phase === 'active' && pc ? (
                <div className="space-y-2 rounded-lg border-2 border-[color:var(--success)]/45 bg-[color:var(--success)]/8 p-3 ring-1 ring-[color:var(--success)]/15">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--text-secondary)]">
                    <CalendarClock className="size-4 shrink-0 text-[color:var(--success)]" aria-hidden />
                    <span className="font-medium text-[var(--text-primary)]">
                      Thời hạn: {formatInsightIsoVi(pc.startAt)}
                      <span className="mx-1.5 font-normal text-[var(--text-muted)]">—</span>
                      {pc.endAt ? formatInsightIsoVi(pc.endAt) : '∞'}
                    </span>
                  </p>
                </div>
              ) : phase === 'upcoming' && pc ? (
                <div className="space-y-2 rounded-lg border-2 border-[color:var(--warning)]/50 bg-[color:var(--warning)]/12 p-3 ring-1 ring-[color:var(--warning)]/20">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--text-secondary)]">
                    <Hourglass className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <span className="font-medium text-[var(--text-primary)]">
                      Bắt đầu chương trình: {formatInsightIsoVi(pc.startAt)}
                    </span>
                  </p>
                  {pc.endAt?.trim() ? (
                    <p className="pl-6 text-[13px] text-[var(--text-muted)]">
                      Dự kiến kết thúc: {formatInsightIsoVi(pc.endAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function VariantSkuCard({
  index,
  control,
  register,
  removeVariant,
  variantCount,
  defaultCatalogUnitStr,
  requireSkuCode,
  fieldIdPrefix,
  nestedErrors,
  inputCls,
  priceRowLabelCls,
  priceRowControlCls,
  invalidOutlineCls,
  skuMediaFooter,
  guestPriceInsight,
  persistedDbVariantId,
}: VariantSkuCardProps) {
  const skuId = `${fieldIdPrefix}-sku`;
  const sortId = `${fieldIdPrefix}-sort`;
  const skuErrId = `${fieldIdPrefix}-sku-err`;
  const activeId = `${fieldIdPrefix}-active`;
  const skuErr = nestedErrors?.skuCode?.message;
  const priceErrMsgs = (): string[] => {
    const pe = nestedErrors?.prices;
    if (pe == null) return [];
    if (Array.isArray(pe)) {
      return pe.flatMap((cell) =>
        cell && typeof cell === 'object'
          ? Object.values(cell).flatMap((x) =>
            x && typeof x === 'object' && 'message' in x && x.message ? [String(x.message)] : []
          )
          : []
      );
    }
    if ('message' in pe && pe.message) return [String(pe.message)];
    return [];
  };
  const priceSectionMsg = priceErrMsgs()[0];
  const optFields = useFieldArray({ control, name: `variants.${index}.optionPairs` });
  const priceFields = useFieldArray({ control, name: `variants.${index}.prices` });

  return (
    <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]">
      <input type="hidden" {...register(`variants.${index}.variantId`)} />

      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">
          <span>Phân loại #{index + 1}</span>
          {persistedDbVariantId != null ? (
            <span className="ms-2 font-[family-name:var(--font-admin-mono)] text-sm font-normal tracking-tight text-[var(--text-muted)]">
              (ID variant {persistedDbVariantId})
            </span>
          ) : null}
        </h3>
        {variantCount > 1 ? (
          <button
            type="button"
            onClick={() => removeVariant(index)}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger)10%,transparent)]"
          >
            Xóa
          </button>
        ) : null}
      </div>

      {/* SKU code + sort + active – 3 cols */}
      <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={skuId}
            className="text-base font-semibold text-[var(--text-secondary)]"
            title="skuCode: mã phân loại / nhập kho (chuỗi). Khác với ID variant (số trong DB — hiển thị ở tiêu đề thẻ)."
          >
            Mã phân loại
            {requireSkuCode ? <span className="text-[var(--danger)]"> *</span> : null}
          </label>
          <input
            id={skuId}
            {...register(`variants.${index}.skuCode`, {
              validate: (v) =>
                requireSkuCode
                  ? (typeof v === 'string' && v.trim() !== '' ? true : 'Cần mã phân loại (skuCode).')
                  : true,
            })}
            autoComplete="off"
            className={clsx(inputCls, skuErr ? invalidOutlineCls : null)}
            placeholder="vd: SP-001-BLUE"
            aria-invalid={skuErr ? true : undefined}
            aria-required={requireSkuCode}
            aria-describedby={skuErr ? skuErrId : undefined}
          />
          {skuErr ? (
            <span id={skuErrId} role="alert" className="text-[11px] text-[var(--danger)]">{String(skuErr)}</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={sortId} className="text-base font-semibold text-[var(--text-secondary)]">
            Thứ tự
          </label>
          <input
            id={sortId}
            {...register(`variants.${index}.sortOrder`)}
            type="number"
            inputMode="numeric"
            min={0}
            autoComplete="off"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col justify-end pb-0.5">
          <label htmlFor={activeId} className="flex cursor-pointer items-center gap-2 text-[18px]">
            <input
              type="checkbox"
              id={activeId}
              {...register(`variants.${index}.active`)}
              className="size-4 shrink-0 rounded border-[var(--bg-border)] accent-[var(--accent)]"
            />
            <span className="text-base font-semibold text-[var(--text-secondary)]">Đang bán</span>
          </label>
        </div>
      </div>

      {/* Thuộc tính */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-semibold text-[var(--text-secondary)]">Thuộc tính (Size, Color…)</span>
          <button
            type="button"
            onClick={() => optFields.append({ optKey: '', optValue: '' })}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            + Thêm
          </button>
        </div>
        <div className="space-y-2">
          {optFields.fields.map((f, opi) => {
            const ok = `${fieldIdPrefix}-opt-${opi}-key`;
            const ov = `${fieldIdPrefix}-opt-${opi}-val`;
            return (
              <div key={f.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  id={ok}
                  {...register(`variants.${index}.optionPairs.${opi}.optKey`)}
                  autoComplete="off"
                  className={priceRowControlCls}
                  placeholder="Key (vd: Color)"
                  aria-label="Tên thuộc tính"
                />
                <input
                  id={ov}
                  {...register(`variants.${index}.optionPairs.${opi}.optValue`)}
                  autoComplete="off"
                  className={priceRowControlCls}
                  placeholder="Giá trị (vd: Đỏ)"
                  aria-label="Giá trị thuộc tính"
                />
                {optFields.fields.length > 1 ? (
                  <button
                    type="button"
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                    onClick={() => optFields.remove(opi)}
                    aria-label="Xóa thuộc tính"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : <div className="hidden sm:block sm:w-10" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Giá */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-base font-semibold text-[var(--text-secondary)]">Giá catalog</span>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
              Mỗi dòng giá thuộc về phân loại này và được áp dụng khi xử lý đơn hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => priceFields.append(emptyCatalogPriceRow(defaultCatalogUnitStr))}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            + Thêm mức giá
          </button>
        </div>
        {priceSectionMsg ? (
          <p role="alert" className="mb-2 text-xs font-semibold text-[var(--danger)]">{priceSectionMsg}</p>
        ) : null}
        <div className="space-y-2">
          {priceFields.fields.map((pf, pidx) => {
            const peRow = nestedErrors?.prices?.[pidx] as Record<string, { message?: string } | undefined> | undefined;
            const curPriceErrMsg = peRow?.currentValue?.message;
            const refPriceErrMsg = peRow?.referencePrice?.message;
            const curId = `${fieldIdPrefix}-p${pidx}-cur`;
            const refId = `${fieldIdPrefix}-p${pidx}-ref`;
            const unitSelId = `${fieldIdPrefix}-p${pidx}-unit`;
            return (
              <Fragment key={pf.id}>
                <input type="hidden" {...register(`variants.${index}.prices.${pidx}.priceId`)} />
                <div className="grid items-start gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  {/* Đơn vị */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor={unitSelId} className={priceRowLabelCls}>Đơn vị</label>
                    <Controller
                      name={`variants.${index}.prices.${pidx}.unitId`}
                      control={control}
                      render={({ field: ctrlField }) => (
                        <UnitSelect
                          id={unitSelId}
                          value={ctrlField.value}
                          onChange={(v) => ctrlField.onChange(String(v))}
                          className="!h-10 !py-0 leading-snug"
                        />
                      )}
                    />
                  </div>
                  {/* Giá bán */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor={curId} className={priceRowLabelCls}>Giá bán (VNĐ)</label>
                    <input
                      id={curId}
                      {...register(`variants.${index}.prices.${pidx}.currentValue`)}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      autoComplete="off"
                      aria-invalid={curPriceErrMsg ? true : undefined}
                      aria-describedby={curPriceErrMsg ? `${curId}-err` : undefined}
                      className={clsx(priceRowControlCls, curPriceErrMsg ? invalidOutlineCls : null)}
                    />
                    {curPriceErrMsg ? (
                      <span id={`${curId}-err`} role="alert" className="text-[11px] text-[var(--danger)]">{String(curPriceErrMsg)}</span>
                    ) : null}
                  </div>
                  {/* Giá tham chiếu */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor={refId} className={priceRowLabelCls}>Giá gốc (VNĐ)</label>
                    <input
                      id={refId}
                      {...register(`variants.${index}.prices.${pidx}.referencePrice`)}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      autoComplete="off"
                      aria-invalid={refPriceErrMsg ? true : undefined}
                      aria-describedby={refPriceErrMsg ? `${refId}-err` : undefined}
                      className={clsx(priceRowControlCls, refPriceErrMsg ? invalidOutlineCls : null)}
                    />
                    {refPriceErrMsg ? (
                      <span id={`${refId}-err`} role="alert" className="text-[11px] text-[var(--danger)]">{String(refPriceErrMsg)}</span>
                    ) : null}
                  </div>
                  {/* Xóa dòng */}
                  {priceFields.fields.length > 1 ? (
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => priceFields.remove(pidx)}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                        aria-label="Xóa mức giá"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {guestPriceInsight ? (
        <GuestStorefrontPriceReconciliation
          effectiveUnitPrice={guestPriceInsight.effectiveUnitPrice}
          activePriceChange={guestPriceInsight.activePriceChange}
          variantDbId={guestPriceInsight.variantDbId}
        />
      ) : null}

      {skuMediaFooter}
    </div>
  );
}

/** Số dòng giá catalog sau khi BE áp removed + new (legacy SPU / phân loại mặc định). */
function catalogPriceRowCountAfterSave(
  initial: ProductPrice[] | null | undefined,
  payload: { removedPriceIds: number[]; newPrices: CreatePriceRequest[] }
): number {
  const n0 = initial?.length ?? 0;
  return n0 - payload.removedPriceIds.length + payload.newPrices.length;
}

export default function AdminProductFormPage() {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetDocIdRef = useRef<number | null>(null);
  const pendingGallerySaveValuesRef = useRef<FormValues | null>(null);
  /** Snapshot `ProductPrice[]` khi load SP — diff form → `removedPriceIds` / `updatedPrices` / `newPrices`. */
  const initialPricesSnapshotRef = useRef<ProductPrice[] | null>(null);
  /** Snapshot từ `GET` khi `variants.length > 0` — PUT `updatedVariants`. */
  const initialVariantsSnapshotRef = useRef<VariantInitialSnapshot[]>([]);
  /** `true`: BE trả `variants[]` — dùng `newVariants`/`updatedVariants` thay legacy `prices` gốc. */
  const usesVariantProductApiRef = useRef(false);

  const isCreate = productId === undefined;
  const isEdit = !isCreate;
  const pid = isEdit ? Number(productId) : NaN;
  const invalidId = isEdit && (!Number.isFinite(pid) || pid <= 0);

  const productQuery = useQuery({
    queryKey: ['admin-product', pid],
    queryFn: ({ signal }) => adminProductService.getById(pid, signal),
    enabled: isEdit && !invalidId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories-flat'],
    queryFn: () => categoryService.getAll(),
    staleTime: 5 * 60_000,
  });

  const brandsQuery = useQuery({
    queryKey: ['admin-brands'],
    queryFn: ({ signal }) => adminBrandService.list(signal),
    staleTime: 60_000,
  });

  const unitsQuery = useQuery({
    queryKey: ['admin-units'],
    queryFn: ({ signal }) => adminUnitService.list(signal),
    staleTime: 5 * 60_000,
  });

  const defaultCatalogUnitStr = useMemo(() => {
    const list = unitsQuery.data ?? [];
    const active = list.filter((u) => u.status === 1);
    const pick = active[0] ?? list[0];
    return pick != null ? String(pick.id) : '';
  }, [unitsQuery.data]);

  const flatCats = useMemo(
    () => flattenCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );

  const defaultValues = useMemo<FormValues>(
    () => ({
      productName: '',
      categoryId: '',
      brandId: '',
      sku: '',
      description: '',
      l_description: '',
      status: '1',
      isFeatured: false,
      hotSale: false,
      variants: [emptyVariantFormRow(0, '')],
    }),
    []
  );

  const formDomId = useId().replace(/:/g, '');

  const {
    register,
    handleSubmit,
    control,
    reset,
    clearErrors,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({ control, name: 'variants' });

  const variantsWatched = useWatch({ control, name: 'variants' }) ?? [];

  const variantSnapshotById = useMemo(() => {
    const m = new Map<number, VariantInitialSnapshot>();
    const snaps = deriveVariantSnapshotsForAdminEdit(productQuery.data ?? null) ?? [];
    for (const s of snaps) m.set(s.id, s);
    return m;
  }, [productQuery.data]);

  const [variantSkuGalleryById, setVariantSkuGalleryById] = useState<
    Record<number, VariantSkuGalleryDraft>
  >({});

  const patchVariantSkuGallery = useCallback((vid: number, patch: Partial<VariantSkuGalleryDraft>) => {
    setVariantSkuGalleryById((prev) => {
      const cur = prev[vid] ?? VARIANT_SKU_GALLERY_EMPTY;
      const next: VariantSkuGalleryDraft = { ...cur };
      if (patch.removedDocumentIds !== undefined) next.removedDocumentIds = [...patch.removedDocumentIds];
      if (patch.pendingFiles !== undefined) next.pendingFiles = patch.pendingFiles;
      if (patch.pendingMainFileIndex !== undefined) next.pendingMainFileIndex = patch.pendingMainFileIndex;
      if (patch.mainPick !== undefined) next.mainPick = patch.mainPick;
      return { ...prev, [vid]: next };
    });
  }, []);

  const [richTextEpoch, setRichTextEpoch] = useState(0);

  useEffect(() => {
    if (!isEdit || !productQuery.data) return;
    const p = productQuery.data;
    const snapsForEdit = deriveVariantSnapshotsForAdminEdit(p);
    if (snapsForEdit?.length) {
      usesVariantProductApiRef.current = true;
      initialVariantsSnapshotRef.current = snapsForEdit.map((s) => ({
        ...s,
        prices: s.prices.map((row) => ({ ...row })),
        documents: s.documents.map((d) => ({ ...d })),
      }));
      initialPricesSnapshotRef.current = [];
      reset({
        productName: p.productName,
        categoryId: String(p.category?.id ?? ''),
        brandId: p.brand?.id != null ? String(p.brand.id) : '',
        sku: p.sku == null ? '' : String(p.sku),
        description: p.description ?? '',
        l_description: p.l_description ?? '',
        status: p.status === 0 ? '0' : '1',
        isFeatured: p.isFeatured,
        hotSale: p.hotSale ?? false,
        variants: variantSnapsToFormValues(snapsForEdit, defaultCatalogUnitStr),
      });
    } else {
      usesVariantProductApiRef.current = false;
      initialVariantsSnapshotRef.current = [];
      const rootPrices =
        Array.isArray(p.prices) && p.prices.length > 0 ? p.prices.map((row) => ({ ...row })) : [];
      initialPricesSnapshotRef.current = rootPrices;
      reset({
        productName: p.productName,
        categoryId: String(p.category?.id ?? ''),
        brandId: p.brand?.id != null ? String(p.brand.id) : '',
        sku: p.sku == null ? '' : String(p.sku),
        description: p.description ?? '',
        l_description: p.l_description ?? '',
        status: p.status === 0 ? '0' : '1',
        isFeatured: p.isFeatured,
        hotSale: p.hotSale ?? false,
        variants: [
          {
            variantId: '',
            skuCode: '',
            active: true,
            sortOrder: '0',
            optionPairs: [{ optKey: '', optValue: '' }],
            prices:
              p.prices && p.prices.length > 0
                ? p.prices.map((row) => ({
                  priceId: String(row.id),
                  unitId: String(row.unitId),
                  currentValue: String(row.currentValue),
                  referencePrice: String(row.oldValue ?? 0),
                }))
                : [emptyCatalogPriceRow(defaultCatalogUnitStr)],
          },
        ],
      });
    }
    setProductTags(parseProductTagList(p.tag ?? ''));
    setTagDraft('');
    setRichTextEpoch((e) => e + 1);
  }, [isEdit, productQuery.data, reset, defaultCatalogUnitStr]);

  const [saving, setSaving] = useState(false);
  const [ldescExpanded, setLdescExpanded] = useState(false);
  const [gallerySaveConfirmOpen, setGallerySaveConfirmOpen] = useState(false);
  /** Nhiều file: chọn ảnh đại diện trong lô trước khi đưa vào hàng chờ multipart — @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §1.2 */
  const [uploadStaging, setUploadStaging] = useState<{ files: File[]; mainFileIndex: number } | null>(
    null
  );
  /**
   * File đã xác nhận, chờ gửi trong cùng một lần Lưu: `multipart` PUT (`newImages` + `product` JSON).
   * @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §1.2 §5
   */
  const [pendingMultipartNewMedia, setPendingMultipartNewMedia] = useState<{
    files: File[];
    mainFileIndex: number;
  } | null>(null);
  /** Ẩn khỏi UI khi chờ save; chưa gọi DELETE / document đến khi PUT product (removedDocumentIds). */
  const [pendingRemovedDocumentIds, setPendingRemovedDocumentIds] = useState<number[]>([]);
  /** File thay ảnh — gọi PUT …/replace sau khi PUT sản phẩm thành công. */
  const [pendingReplaceByDocId, setPendingReplaceByDocId] = useState<Record<number, File>>({});
  const [blockingFormMessage, setBlockingFormMessage] = useState('');
  /** `null` = giữ như máy chủ; set khi đổi radio main — gửi mainDocumentId khi Save. */
  const [draftMainDocumentId, setDraftMainDocumentId] = useState<number | null>(null);

  /** Tag hiển thị dạng chip — khi lưu gửi BE là một chuỗi phân tách dấu phẩy. */
  const [productTags, setProductTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const productLoaded = productQuery.data;

  const productProgramsSnapshot = useMemo(() => {
    if (!productLoaded) return null;
    const raw = productLoaded as unknown as Record<string, unknown>;
    const fromEffective = readFiniteNumberOrNull(raw.fromEffectiveUnitPrice, raw.from_effective_unit_price);
    const tiers = coerceVolumePriceTiersFromUnknown(raw.volumePriceTiers ?? raw.volume_price_tiers);
    const pwp = coercePwpProgramsFromUnknown(
      raw.purchaseWithPurchasePrograms ?? raw.purchase_with_purchase_programs
    );
    if (fromEffective == null && tiers.length === 0 && pwp.length === 0) return null;
    return { fromEffective, tiers, pwp };
  }, [productLoaded]);

  /** Derive hiển thị gợi ý (đồng bộ GET `variants[]`, không chỉ ref). */
  const detailVariantTabsFromApi = useMemo(
    () => Boolean(productLoaded && deriveVariantSnapshotsForAdminEdit(productLoaded)?.length),
    [productLoaded]
  );

  const variantSnapshotsForSkuMedia = useMemo(
    () => deriveVariantSnapshotsForAdminEdit(productLoaded ?? null) ?? [],
    [productLoaded]
  );

  const hasPendingVariantSkuGallery = useMemo(() => {
    for (const snap of variantSnapshotsForSkuMedia) {
      const g = variantSkuGalleryById[snap.id];
      if (!g) continue;
      if (variantSkuGalleryHasPendingEdits(g, snap)) return true;
    }
    return false;
  }, [variantSnapshotsForSkuMedia, variantSkuGalleryById]);

  useEffect(() => {
    setPendingRemovedDocumentIds([]);
    setPendingReplaceByDocId({});
    setDraftMainDocumentId(null);
    setUploadStaging(null);
    setPendingMultipartNewMedia(null);
    setVariantSkuGalleryById({});
  }, [pid]);

  useEffect(() => {
    if (
      draftMainDocumentId != null &&
      pendingRemovedDocumentIds.includes(draftMainDocumentId)
    ) {
      setDraftMainDocumentId(null);
    }
  }, [draftMainDocumentId, pendingRemovedDocumentIds]);

  useEffect(() => {
    if (isEdit) return;
    setProductTags([]);
    setTagDraft('');
  }, [isEdit]);

  const commitTagDraft = useCallback(() => {
    const trimmed = tagDraft.trim();
    if (!trimmed) return;
    setProductTags((prev) => mergeUniqueTagsFromInput(prev, tagDraft));
    setTagDraft('');
  }, [tagDraft]);

  const removeProductTag = useCallback((label: string) => {
    setProductTags((prev) => prev.filter((x) => x !== label));
  }, []);

  const serializedTagsForApi = useMemo(() => serializeProductTags(productTags), [productTags]);

  const serverMediaItems = useMemo((): ServerMediumItem[] => {
    if (!productLoaded) return [];
    const docs = productLoaded.documents;
    if (docs?.length) {
      return [...docs]
        .filter((d) => typeof d.filePath === 'string' && d.filePath.trim() !== '')
        .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
        .map((d) => {
          const rawPath = d.filePath!.trim();
          const displayUrl = publicDocumentFileUrl(rawPath);
          const docType = typeof d.type === 'number' ? d.type : null;
          const isVideo = documentKindIsVideo(docType, rawPath);
          const coverEligible = documentKindCanBeCover(docType, rawPath);
          const isMainCover = documentIsMainCoverFlag(docType, readDocumentIsMain(d), rawPath);
          const fileLabel = typeof d.fileName === 'string' && d.fileName.trim() !== '' ? d.fileName.trim() : '';
          const title =
            fileLabel || (d.id != null ? `Tệp đính kèm (mã ${d.id})` : rawPath.slice(-32));
          const docIdNum =
            d.id != null && Number.isFinite(Number(d.id)) ? Number(d.id) : undefined;
          return {
            key: `doc-${d.id ?? rawPath}`,
            title,
            displayUrl,
            isVideo,
            rawPath,
            docType,
            documentId: docIdNum,
            isMainCover,
            coverEligible,
          };
        });
    }
    const urls = productLoaded.imageUrls ?? [];
    return urls.map((rawPath, i) => ({
      key: `img-${i}-${rawPath}`,
      title: `Ảnh ${i + 1}`,
      displayUrl: publicDocumentFileUrl(rawPath),
      isVideo: false,
      rawPath,
      docType: 1,
      /** `imageUrls`: main trước theo BE — phần tử đầu coi như đại diện khi không có `documents`. */
      isMainCover: i === 0,
      coverEligible: true,
      documentId: undefined,
    }));
  }, [productLoaded]);

  const visibleMediaItems = useMemo(() => {
    const rm = new Set(pendingRemovedDocumentIds);
    return serverMediaItems.filter((i) => i.documentId == null || !rm.has(i.documentId));
  }, [serverMediaItems, pendingRemovedDocumentIds]);

  const replacePreviewSrcByDocId = useMemo(() => {
    const m: Record<number, string> = {};
    for (const [k, f] of Object.entries(pendingReplaceByDocId)) {
      m[Number(k)] = URL.createObjectURL(f);
    }
    return m;
  }, [pendingReplaceByDocId]);

  useEffect(() => {
    const urls = replacePreviewSrcByDocId;
    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [replacePreviewSrcByDocId]);

  /** Blob URL thumbnails cho staging (chọn ảnh đại diện trước khi confirm). */
  const uploadStagingPreviews = useMemo(() => {
    if (!uploadStaging) return [] as { url: string | null; name: string }[];
    return uploadStaging.files.map((f) => ({
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      name: f.name,
    }));
  }, [uploadStaging]);

  useEffect(() => {
    const previews = uploadStagingPreviews;
    return () => { previews.forEach(({ url }) => { if (url) URL.revokeObjectURL(url); }); };
  }, [uploadStagingPreviews]);

  /** Blob URL thumbnails cho pending new media (đã confirm, chờ lưu). */
  const pendingNewMediaPreviews = useMemo(() => {
    if (!pendingMultipartNewMedia) return [] as { url: string | null; name: string; isMain: boolean; index: number }[];
    return pendingMultipartNewMedia.files.map((f, i) => ({
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      name: f.name,
      isMain: i === pendingMultipartNewMedia.mainFileIndex,
      index: i,
    }));
  }, [pendingMultipartNewMedia]);

  useEffect(() => {
    const previews = pendingNewMediaPreviews;
    return () => { previews.forEach(({ url }) => { if (url) URL.revokeObjectURL(url); }); };
  }, [pendingNewMediaPreviews]);

  const serverMainDocumentIdFromList = useMemo(() => {
    const main = serverMediaItems.find(
      (i) => i.documentId != null && i.coverEligible && i.isMainCover
    );
    return main?.documentId ?? null;
  }, [serverMediaItems]);

  const hasPendingGalleryEdits =
    pendingRemovedDocumentIds.length > 0 ||
    (pendingMultipartNewMedia != null && pendingMultipartNewMedia.files.length > 0) ||
    Object.keys(pendingReplaceByDocId).length > 0 ||
    hasPendingVariantSkuGallery ||
    (draftMainDocumentId !== null &&
      draftMainDocumentId !== serverMainDocumentIdFromList);

  const galleryImageSlides = useMemo((): GalleryImageSlide[] => {
    return visibleMediaItems
      .map((item) => {
        const rep =
          item.documentId != null ? replacePreviewSrcByDocId[item.documentId] : undefined;
        const src = rep ?? galleryImageSrc(item);
        return src ? { key: item.key, title: item.title, src } : null;
      })
      .filter((x): x is GalleryImageSlide => x !== null);
  }, [visibleMediaItems, replacePreviewSrcByDocId]);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [saveBanner, setSaveBanner] = useState<'created' | 'updated' | null>(null);

  const openGalleryAtKey = useCallback(
    (key: string) => {
      const i = galleryImageSlides.findIndex((s) => s.key === key);
      if (i >= 0) setPreviewIndex(i);
    },
    [galleryImageSlides]
  );

  const closeGallery = useCallback(() => setPreviewIndex(null), []);

  useEffect(() => {
    if (previewIndex === null) return undefined;
    if (galleryImageSlides.length === 0) {
      setPreviewIndex(null);
      return undefined;
    }
    if (previewIndex >= galleryImageSlides.length) {
      setPreviewIndex(galleryImageSlides.length - 1);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeGallery();
        return;
      }
      const n = galleryImageSlides.length;
      if (n <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPreviewIndex((prev) =>
          prev == null ? 0 : prev + 1 >= n ? 0 : prev + 1
        );
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPreviewIndex((prev) =>
          prev == null ? n - 1 : prev <= 0 ? n - 1 : prev - 1
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex, galleryImageSlides.length, closeGallery]);

  useEffect(() => {
    if (previewIndex === null) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [previewIndex]);

  useLayoutEffect(() => {
    const st = location.state as NavigateSaveFlash;
    if (st?.saveFlash !== 'created') return undefined;
    setSaveBanner('created');
    notify.success(
      typeof st.savedProductId === 'number'
        ? `Đã tạo và lưu sản phẩm (mã ${st.savedProductId}).`
        : 'Đã tạo và lưu sản phẩm.',
      {
        subtitle: 'Có thể tiếp tục chỉnh sửa và thêm ảnh hoặc video sản phẩm.',
        duration: 5500,
      }
    );
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    return undefined;
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!saveBanner) return undefined;
    const timer = window.setTimeout(() => setSaveBanner(null), 9000);
    return () => clearTimeout(timer);
  }, [saveBanner]);

  const clearFileInputValue = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const clearReplaceFileInputValue = useCallback(() => {
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  }, []);

  const runReplaceImage = useCallback((documentId: number, file: File) => {
    setPendingReplaceByDocId((prev) => ({ ...prev, [documentId]: file }));
  }, []);

  const markDocumentHiddenUntilSave = useCallback((documentId: number) => {
    setPendingRemovedDocumentIds((prev) => (prev.includes(documentId) ? prev : [...prev, documentId]));
    setPendingReplaceByDocId((prev) => {
      if (!(documentId in prev)) return prev;
      const { [documentId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const openReplaceImagePicker = useCallback((documentId: number) => {
    replaceTargetDocIdRef.current = documentId;
    replaceFileInputRef.current?.click();
  }, []);

  const onReplaceFilePickerChange = useCallback(
    (files: FileList | null) => {
      const docId = replaceTargetDocIdRef.current;
      replaceTargetDocIdRef.current = null;
      clearReplaceFileInputValue();
      if (docId == null || !files?.length) return;
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        notify.error('Thay ảnh chỉ chấp nhận file ảnh (JPEG, PNG, WebP…).');
        return;
      }
      runReplaceImage(docId, file);
    },
    [clearReplaceFileInputValue, runReplaceImage]
  );

  const onFilePickerChange = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      if (!isEdit || !Number.isFinite(pid)) {
        notify.info(
          'Hãy tạo và lưu sản phẩm trước. Sau khi có mã sản phẩm, mở trang chỉnh sửa để đăng ảnh hay video tại đây.'
        );
        clearFileInputValue();
        return;
      }
      const list = Array.from(files);
      if (list.length === 1) {
        const only = list[0];
        const mainIdx = only.type.startsWith('image/') ? 0 : 0;
        setPendingMultipartNewMedia({ files: list, mainFileIndex: mainIdx });
        notify.info(
          'Tệp đã được thêm vào hàng chờ. Nhấn «Lưu sản phẩm» để tải lên.',
          { duration: 5200 }
        );
        clearFileInputValue();
        return;
      }
      const firstImg = firstImageFileIndex(list);
      setUploadStaging({
        files: list,
        mainFileIndex: firstImg ?? 0,
      });
      clearFileInputValue();
    },
    [isEdit, pid, clearFileInputValue]
  );

  const cancelUploadStaging = useCallback(() => {
    setUploadStaging(null);
    clearFileInputValue();
  }, [clearFileInputValue]);

  const removePendingNewFile = useCallback((index: number) => {
    setPendingMultipartNewMedia((prev) => {
      if (!prev) return null;
      const newFiles = prev.files.filter((_, i) => i !== index);
      if (newFiles.length === 0) return null;
      let newMain = prev.mainFileIndex;
      if (index < newMain) newMain--;
      else if (index === newMain) newMain = Math.min(newMain, newFiles.length - 1);
      return { files: newFiles, mainFileIndex: newMain };
    });
  }, []);

  const selectDraftMainDocument = useCallback((documentId: number) => {
    if (!Number.isFinite(pid)) return;
    setDraftMainDocumentId(documentId);
  }, [pid]);

  const confirmUploadStaging = useCallback(() => {
    if (!uploadStaging) return;
    const { files, mainFileIndex } = uploadStaging;
    const picked = files[mainFileIndex];
    const mainIdx =
      picked?.type.startsWith('image/') ? mainFileIndex : (firstImageFileIndex(files) ?? mainFileIndex);
    setPendingMultipartNewMedia({
      files: [...files],
      mainFileIndex: mainIdx,
    });
    setUploadStaging(null);
    notify.info(
      'Đã chọn ảnh đại diện cho lô. Nhấn «Lưu sản phẩm» để tải lên.',
      { duration: 5200 }
    );
  }, [uploadStaging]);

  const submitCreate = async (values: FormValues) => {
    clearErrors();
    setBlockingFormMessage('');

    const vf = validateEditProductForm(values, { requireVariantSkuCodes: true });
    if (vf) {
      const { fieldMapped } = applyProductFormValidationFeedback(setError, setFocus, vf);
      if (!fieldMapped) setBlockingFormMessage(vf);
      notify.error(vf);
      return;
    }

    const cat = Number(values.categoryId);
    const skuRaw = values.sku.trim();
    const skuNum: number | null = skuRaw === '' ? null : Number(skuRaw);

    const variantsPayload = values.variants.map((v, i) => {
      const sortOrderNum = Number(v.sortOrder.trim());
      const plist = rowsToCreatePriceRequests(v.prices);
      return {
        skuCode: v.skuCode.trim(),
        optionValues: optionPairsToRecord(v.optionPairs),
        active: Boolean(v.active),
        sortOrder: Number.isFinite(sortOrderNum) ? sortOrderNum : i,
        ...(plist.length > 0 ? { prices: plist } : {}),
      };
    });
    const brandRaw = values.brandId.trim();
    const brandPick = brandRaw === '' ? null : Number(brandRaw);
    setSaving(true);
    try {
      const descriptionOut = compactOptionalRichHtml(values.description);
      const longOut = compactOptionalRichHtml(values.l_description);
      const created = await adminProductService.create({
        productName: values.productName.trim(),
        categoryId: cat,
        ...(brandPick != null && brandPick > 0 ? { brandId: brandPick } : {}),
        ...(descriptionOut ? { description: descriptionOut } : {}),
        ...(longOut ? { l_description: longOut } : {}),
        tag: serializedTagsForApi,
        status: values.status === '0' ? 0 : 1,
        sku: skuNum,
        isFeatured: values.isFeatured,
        hotSale: values.hotSale,
        variants: variantsPayload,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setBlockingFormMessage('');
      navigate(`/admin/products/${created.id}/edit`, {
        replace: true,
        state: { saveFlash: 'created', savedProductId: created.id },
      });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không tạo được sản phẩm'));
    } finally {
      setSaving(false);
    }
  };

  const executeProductUpdate = async (values: FormValues) => {
    const vf = validateEditProductForm(values, {
      requireVariantSkuCodes: usesVariantProductApiRef.current,
    });
    if (vf) {
      const { fieldMapped } = applyProductFormValidationFeedback(setError, setFocus, vf);
      if (!fieldMapped) setBlockingFormMessage(vf);
      notify.error(vf);
      return;
    }
    const cat = Number(values.categoryId);
    const brandRaw = values.brandId.trim();
    let brandPick: number | null = null;
    if (brandRaw !== '') {
      brandPick = Number(brandRaw);
    }
    const skuRaw = values.sku.trim();
    const skuNum: number | null = skuRaw === '' ? null : Number(skuRaw);

    setSaving(true);
    try {
      const descriptionOut = compactOptionalRichHtml(values.description);
      const longOut = compactOptionalRichHtml(values.l_description);

      const toRemoveSnapshot = [...pendingRemovedDocumentIds];
      const replaceSnapshot = { ...pendingReplaceByDocId };
      const mainDraftSnapshot = draftMainDocumentId;
      const multipartSnap =
        pendingMultipartNewMedia != null && pendingMultipartNewMedia.files.length > 0
          ? {
            files: [...pendingMultipartNewMedia.files],
            mainFileIndex: pendingMultipartNewMedia.mainFileIndex,
          }
          : null;

      const legacyPriceRows = values.variants[0]?.prices ?? [];

      const variantSkuGallerySnap = { ...variantSkuGalleryById };

      let updateBody: Parameters<typeof adminProductService.update>[1];

      if (usesVariantProductApiRef.current) {
        const snaps = initialVariantsSnapshotRef.current;
        const vb = buildMultiVariantUpdatePayload(values.variants, snaps, pid);

        let mergedVariants = mergeVariantSkuGalleryIntoUpdatedVariants(
          values.variants,
          snaps,
          variantSkuGallerySnap,
          vb.updatedVariants
        );

        updateBody = {
          productName: values.productName.trim(),
          ...(descriptionOut ? { description: descriptionOut } : {}),
          ...(longOut ? { l_description: longOut } : {}),
          tag: serializedTagsForApi,
          status: Number(values.status),
          categoryId: cat,
          // Chỉ gửi brandId khi có giá trị hợp lệ; API hiện không hỗ trợ xóa hãng qua null
          ...(brandPick != null && brandPick > 0 ? { brandId: brandPick } : {}),
          sku: skuNum,
          isFeatured: values.isFeatured,
          hotSale: values.hotSale,
          ...(toRemoveSnapshot.length > 0 ? { removedDocumentIds: toRemoveSnapshot } : {}),
          ...(mainDraftSnapshot != null ? { mainDocumentId: mainDraftSnapshot } : {}),
          ...(vb.removedVariantIds.length > 0 ? { removedVariantIds: vb.removedVariantIds } : {}),
          ...(vb.newVariants.length > 0 ? { newVariants: vb.newVariants } : {}),
          ...(mergedVariants.length > 0 ? { updatedVariants: mergedVariants } : {}),
        };
      } else {
        /**
         * Giá legacy ở gốc request: áp vào phân loại đại diện (sortOrder nhỏ nhất; trùng thì id nhỏ hơn).
         * @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.3 §7
         */
        const pricePayload = buildCatalogPriceUpdatePayload(
          legacyPriceRows,
          initialPricesSnapshotRef.current,
          pid
        );
        const initialPriceRows = initialPricesSnapshotRef.current ?? [];
        if (
          initialPriceRows.length > 0 &&
          catalogPriceRowCountAfterSave(initialPricesSnapshotRef.current, pricePayload) < 1
        ) {
          notify.error(
            'Không thể xóa hết giá catalog khi chưa có ít nhất một dòng giá thay thế — có thể gây lỗi đặt hàng. Hãy thêm hoặc giữ một dòng có đơn vị và giá hợp lệ trước khi lưu.'
          );
          setSaving(false);
          return;
        }

        /**
         * SPU không có dòng SKU trên FE (variants[] / product_variant_id) nhưng user thêm giá lần đầu —
         * không gửi `newPrices` ở gốc (BE không có phân loại đại diện) mà bootstrap một SKU trong `newVariants`.
         * @see docs/FE_PRODUCT_VARIANTS.md §2.2 (tạo mặc định — tương tự khi chỉ có `prices`).
         */
        const noVariantResolvedOnFe = deriveVariantSnapshotsForAdminEdit(productQuery.data) == null;
        const canBootstrapFirstVariant =
          noVariantResolvedOnFe &&
          initialPriceRows.length === 0 &&
          pricePayload.removedPriceIds.length === 0 &&
          pricePayload.updatedPrices.length === 0 &&
          pricePayload.newPrices.length > 0;

        const commonScalars = {
          productName: values.productName.trim(),
          ...(descriptionOut ? { description: descriptionOut } : {}),
          ...(longOut ? { l_description: longOut } : {}),
          tag: serializedTagsForApi,
          status: Number(values.status),
          categoryId: cat,
          // Chỉ gửi brandId khi có giá trị hợp lệ; API hiện không hỗ trợ xóa hãng qua null
          ...(brandPick != null && brandPick > 0 ? { brandId: brandPick } : {}),
          sku: skuNum,
          isFeatured: values.isFeatured,
          hotSale: values.hotSale,
          ...(toRemoveSnapshot.length > 0 ? { removedDocumentIds: toRemoveSnapshot } : {}),
          ...(mainDraftSnapshot != null ? { mainDocumentId: mainDraftSnapshot } : {}),
        };

        if (canBootstrapFirstVariant) {
          const v0 = values.variants[0];
          const optionRaw = optionPairsToRecord(v0.optionPairs);
          const optionValues =
            Object.keys(optionRaw).length > 0 ? optionRaw : { Default: 'Mặc định' };
          const sortOrderLoose = Number(v0.sortOrder.trim());
          const variantSortOrder = Number.isFinite(sortOrderLoose) ? sortOrderLoose : 0;
          let skuStr = v0.skuCode.trim();
          if (!skuStr) skuStr = skuRaw.trim() !== '' ? skuRaw.trim() : `SPU-${pid}`;

          updateBody = {
            ...commonScalars,
            newVariants: [
              {
                skuCode: skuStr,
                optionValues,
                active: Boolean(v0.active),
                sortOrder: variantSortOrder,
                prices: pricePayload.newPrices,
              },
            ],
          };
        } else {
          updateBody = {
            ...commonScalars,
            ...(pricePayload.removedPriceIds.length > 0 ? { removedPriceIds: pricePayload.removedPriceIds } : {}),
            ...(pricePayload.updatedPrices.length > 0 ? { updatedPrices: pricePayload.updatedPrices } : {}),
            ...(pricePayload.newPrices.length > 0 ? { newPrices: pricePayload.newPrices } : {}),
          };
        }
      }

      const multipartFiles = multipartSnap?.files;
      const useMultipartPut = Boolean(multipartFiles?.length);
      let productPayload: UpdateProductRequest = updateBody;
      if (useMultipartPut && multipartFiles != null && multipartSnap != null) {
        productPayload = { ...updateBody };
        if (mainDraftSnapshot != null) {
          // GUIDE §3.2 — `mainDocumentId` được áp sau cùng và ghi đè main của file mới; không mix `mainNewImageIndex`.
        } else {
          const fi = firstImageFileIndex(multipartFiles);
          if (fi !== undefined) {
            let mainIx = multipartSnap.mainFileIndex;
            const atPick = multipartFiles[mainIx];
            if (!atPick?.type.startsWith('image/')) mainIx = fi;
            productPayload = { ...updateBody, mainNewImageIndex: mainIx };
          }
        }
      }

      const variantSkuMediaAffected = variantSnapshotsForSkuMedia.some((snap) =>
        variantSkuGalleryHasPendingEdits(
          variantSkuGallerySnap[snap.id] ?? VARIANT_SKU_GALLERY_EMPTY,
          snap
        )
      );

      if (useMultipartPut && multipartFiles != null) {
        await adminProductService.updateMultipart(pid, productPayload, { newImages: multipartFiles });
      } else {
        await adminProductService.update(pid, updateBody);
      }

      let variantSkuImageUploadFails: number[] = [];
      const attemptedVariantImgUploadIds: number[] = [];
      if (usesVariantProductApiRef.current) {
        for (const row of values.variants) {
          const rawVid = row.variantId?.trim();
          if (!rawVid) continue;
          const vid = Number(rawVid);
          if (!Number.isFinite(vid) || vid <= 0) continue;
          const gDraft = variantSkuGallerySnap[vid];
          if (!gDraft) continue;
          const files = gDraft.pendingFiles;
          if (!files?.length) continue;
          attemptedVariantImgUploadIds.push(vid);
          try {
            let mainNewIx: number | undefined;
            if (gDraft.mainPick.kind === 'pendingFile') {
              mainNewIx = normalizeVariantMultipartMainImageIndex(files, gDraft.mainPick.fileIndex);
            } else if (gDraft.mainPick.kind === 'inherit') {
              mainNewIx = normalizeVariantMultipartMainImageIndex(files, gDraft.pendingMainFileIndex);
            }
            await adminProductService.uploadVariantImages(pid, vid, {
              files: [...files],
              ...(mainNewIx !== undefined ? { mainNewImageIndex: mainNewIx } : {}),
            });
          } catch {
            variantSkuImageUploadFails.push(vid);
          }
        }
      }

      const replaceFails: number[] = [];
      for (const [sid, file] of Object.entries(replaceSnapshot)) {
        const docId = Number(sid);
        if (!Number.isFinite(docId) || toRemoveSnapshot.includes(docId)) continue;
        try {
          await adminDocumentService.replaceFile(docId, file);
        } catch {
          replaceFails.push(docId);
        }
      }

      const galleryTouched =
        toRemoveSnapshot.length > 0 ||
        Object.keys(replaceSnapshot).length > 0 ||
        multipartSnap != null ||
        (mainDraftSnapshot != null && mainDraftSnapshot !== serverMainDocumentIdFromList) ||
        variantSkuMediaAffected;


      setPendingRemovedDocumentIds([]);
      setDraftMainDocumentId(null);
      setPendingMultipartNewMedia(null);
      setUploadStaging(null);
      if (replaceFails.length === 0) {
        setPendingReplaceByDocId({});
      } else {
        const keep: Record<number, File> = {};
        const failSet = new Set(replaceFails);
        for (const [sid, file] of Object.entries(replaceSnapshot)) {
          const docId = Number(sid);
          if (failSet.has(docId)) keep[docId] = file;
        }
        setPendingReplaceByDocId(keep);
      }

      if (variantSkuImageUploadFails.length === 0) {
        setVariantSkuGalleryById({});
      } else {
        setVariantSkuGalleryById((prev) => {
          const n = { ...prev };
          for (const vid of attemptedVariantImgUploadIds) {
            if (variantSkuImageUploadFails.includes(vid)) continue;
            const cur = n[vid];
            if (!cur) continue;
            n[vid] = {
              ...cur,
              pendingFiles: null,
              pendingMainFileIndex: 0,
              mainPick: cur.mainPick.kind === 'pendingFile' ? { kind: 'inherit' } : cur.mainPick,
            };
          }
          return n;
        });
      }

      const replaceImagesFailed = replaceFails.length > 0;
      const variantSkuUploadFailed = variantSkuImageUploadFails.length > 0;

      if (replaceImagesFailed || variantSkuUploadFailed) {
        const chunks: string[] = ['Đã lưu thông tin sản phẩm.'];
        if (replaceImagesFailed) {
          chunks.push(
            'Một hoặc nhiều ảnh SPU chưa thể thay thế — bản đã chọn vẫn giữ trong form, hãy thử lưu lại sau.'
          );
        }
        if (variantSkuUploadFailed) {
          chunks.push(
            'Ảnh một hoặc nhiều SKU chưa tải lên — các lô chờ vẫn giữ trong form, hãy thử Lưu lại.'
          );
        }
        notify.error(chunks.join(' '));
      } else {
        setSaveBanner('updated');
        notify.success(
          galleryTouched ? 'Đã lưu thông tin và cập nhật thư viện ảnh/video.' : 'Đã lưu thông tin sản phẩm.',
          galleryTouched
            ? { duration: 5000 }
            : {
              subtitle: 'Thay đổi đã được lưu và áp dụng cho cửa hàng của bạn.',
              duration: 5000,
            }
        );
      }
      setBlockingFormMessage('');

      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', pid] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Không lưu được thông tin sản phẩm'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (values: FormValues) => {
    clearErrors();
    setBlockingFormMessage('');
    const vf = validateEditProductForm(values, {
      requireVariantSkuCodes: usesVariantProductApiRef.current,
    });
    if (vf) {
      const { fieldMapped } = applyProductFormValidationFeedback(setError, setFocus, vf);
      if (!fieldMapped) setBlockingFormMessage(vf);
      notify.error(vf);
      return;
    }
    if (hasPendingGalleryEdits) {
      pendingGallerySaveValuesRef.current = values;
      setGallerySaveConfirmOpen(true);
      return;
    }
    await executeProductUpdate(values);
  };

  const confirmGalleryThenSave = async () => {
    const v = pendingGallerySaveValuesRef.current;
    if (!v) {
      setGallerySaveConfirmOpen(false);
      return;
    }
    await executeProductUpdate(v);
    pendingGallerySaveValuesRef.current = null;
    setGallerySaveConfirmOpen(false);
  };

  const formRouteProductKey =
    isEdit && Number.isFinite(pid) ? String(pid) : 'new';

  const fieldIds = {
    productName: `${formDomId}-product-name`,
    skuSpu: `${formDomId}-sku-spu`,
    internalPid: `${formDomId}-internal-pid`,
    category: `${formDomId}-category`,
    brand: `${formDomId}-brand`,
    tagInput: `${formDomId}-tag-draft`,
    status: `${formDomId}-status`,
    featured: `${formDomId}-is-featured`,
    hotSale: `${formDomId}-hot-sale`,
  };

  const descEditorId = `admin-product-desc-${formRouteProductKey}`;
  const ldescEditorId = `admin-product-ldesc-${formRouteProductKey}`;

  const inputCls = clsx(
    'w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  );

  const invalidOutlineCls =
    'border-[color-mix(in_srgb,var(--danger)55%,var(--bg-border))] ring-2 ring-[color-mix(in_srgb,var(--danger)28%,transparent)]';

  /** Ô đơn vị / giá trong hàng — cùng chiều cao để không lệch với native select */
  const priceRowControlCls = clsx(
    'h-10 w-full shrink-0 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-0 text-sm leading-snug text-[var(--text-primary)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  );

  const priceRowLabelCls = 'block min-h-[2lh] text-[15px] font-semibold leading-tight text-[var(--text-muted)]';

  const richEditorSkeletonCls = clsx(
    'w-full animate-pulse rounded-lg border border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]'
  );

  if (invalidId) {
    return (
      <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
        Địa chỉ sản phẩm không hợp lệ hoặc sản phẩm không còn trong danh mục quản trị của bạn.
        <Link to="/admin/products" className="ms-2 text-[var(--accent)] underline">
          Về danh sách
        </Link>
      </div>
    );
  }

  if (isEdit && productQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-[var(--text-secondary)]">
        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
        Đang tải sản phẩm…
      </div>
    );
  }

  if (isEdit && productQuery.isError) {
    return (
      <div className="rounded-xl border border-[var(--danger)]/40 p-6 text-sm text-[var(--danger)]">
        {getApiErrorMessage(productQuery.error, 'Không tải được sản phẩm.')}
        <Link to="/admin/products" className="mt-2 block text-[var(--accent)] underline">
          Về danh sách
        </Link>
      </div>
    );
  }

  const formId = `${formDomId}-form`;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/products"
            className={clsx(
              'rounded-lg p-1.5 text-[var(--text-secondary)]',
              'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
            aria-label="Về danh sách sản phẩm"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-[15px] font-medium text-[var(--text-secondary)]">
              {isEdit ? `Sản phẩm #${pid}` : 'Sản phẩm mới'}
            </p>
            <h1 className="font-[family-name:var(--font-admin-heading)] text-lg font-semibold leading-snug text-[var(--text-primary)]">
              {isEdit
                ? (productLoaded?.productName ?? 'Đang tải…')
                : 'Thêm sản phẩm mới'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/products"
            className={clsx(
              'inline-flex items-center justify-center rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold',
              'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            Hủy
          </Link>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className={clsx(
              'inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white',
              'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
          </button>
        </div>
      </div>

      {/* ── Save banner ── */}
      {saveBanner ? (
        <div
          role="status"
          aria-live="polite"
          className={clsx(
            'flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 shadow-[var(--card-shadow)]',
            'border-[color:color-mix(in_srgb,var(--success)42%,transparent)]',
            'bg-[color:color-mix(in_srgb,var(--success)10%,var(--bg-surface))]'
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-[color:var(--success)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-[var(--text-primary)]">
                {saveBanner === 'created' ? 'Đã tạo sản phẩm thành công' : 'Đã lưu thay đổi'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {saveBanner === 'created'
                  ? 'Có thể tiếp tục chỉnh sửa và thêm ảnh/video sản phẩm.'
                  : 'Nội dung đã được cập nhật trên cửa hàng.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Đóng thông báo"
            onClick={() => setSaveBanner(null)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ── Form ── */}
      <form id={formId} autoComplete="off" onSubmit={handleSubmit(isEdit ? handleEditSubmit : submitCreate)}>

        {/* Blocking error */}
        {blockingFormMessage ? (
          <div
            role="alert"
            className={clsx(
              'mb-5 flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed',
              'border-[var(--danger)]/45 bg-[color:color-mix(in_srgb,var(--danger)10%,var(--bg-surface))] text-[var(--danger)]'
            )}
          >
            <p className="min-w-0 flex-1 font-medium">{blockingFormMessage}</p>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline hover:bg-black/10"
              onClick={() => setBlockingFormMessage('')}
            >
              Đóng
            </button>
          </div>
        ) : null}

        {/* ── Two-column layout ── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

          {/* ════ LEFT / MAIN COLUMN ════ */}
          <div className="min-w-0 space-y-5">

            {/* Card: Thông tin sản phẩm */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5', 'shadow-[var(--card-shadow)]')}>
              <h2 className="mb-1 text-[18px] font-semibold text-[var(--text-primary)]">Thông tin sản phẩm</h2>
              <p className="mb-4 text-[12px] leading-snug text-[var(--text-muted)]">
                Dữ liệu cấp SPU (sản phẩm tổng quát): tên và mô tả. Danh mục, hãng, trạng thái, tag và SKU số (SPU) nằm cột bên phải; giá niêm yết từng phân loại nằm ở khối Phân loại & giá phía dưới.
              </p>
              <div className="space-y-4">
                {/* Tên */}
                <div className="flex flex-col gap-1">
                  <label htmlFor={fieldIds.productName} className="text-base font-semibold text-[var(--text-secondary)]">
                    Tên hiển thị<span className="text-[var(--danger)]"> *</span>
                  </label>
                  <input
                    id={fieldIds.productName}
                    {...register('productName', {
                      required: 'Không được để trống tên được hiển thị trong cửa hàng.',
                      maxLength: { value: 500, message: 'Tên không nên quá 500 ký tự.' },
                      setValueAs: (v) => (typeof v === 'string' ? v : ''),
                    })}
                    aria-invalid={errors.productName ? true : undefined}
                    aria-required
                    aria-describedby={errors.productName ? `${fieldIds.productName}-err` : undefined}
                    autoComplete="off"
                    className={clsx(inputCls, errors.productName ? invalidOutlineCls : null)}
                    placeholder="Tên hiển thị trên cửa hàng"
                  />
                  {errors.productName?.message ? (
                    <span id={`${fieldIds.productName}-err`} role="alert" className="text-[11px] text-[var(--danger)]">
                      {String(errors.productName.message)}
                    </span>
                  ) : null}
                </div>

                {/* Mô tả ngắn */}
                <div className="flex flex-col gap-1">
                  <label htmlFor={descEditorId} className="text-base font-semibold text-[var(--text-secondary)]">
                    Mô tả ngắn
                  </label>
                  <Suspense
                    fallback={
                      <div className={clsx(richEditorSkeletonCls, 'min-h-[220px]')} aria-busy="true" />
                    }
                  >
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <AdminProductRichTextEditor
                          id={descEditorId}
                          mountKey={`${richTextEpoch}-desc`}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          height={220}
                          maxHeight={480}
                        />
                      )}
                    />
                  </Suspense>
                </div>

                {/* Mô tả chi tiết — collapsible */}
                <div className="rounded-lg border border-[var(--bg-border)]">
                  <button
                    type="button"
                    onClick={() => setLdescExpanded((v) => !v)}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-2.5 text-left',
                      'hover:bg-[var(--bg-elevated)]/60',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]',
                      ldescExpanded ? 'rounded-t-lg' : 'rounded-lg'
                    )}
                    aria-expanded={ldescExpanded}
                    aria-controls={ldescEditorId}
                  >
                    <span className="text-base font-semibold text-[var(--text-secondary)]">Mô tả chi tiết</span>
                    <ChevronDown
                      className={clsx(
                        'size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
                        ldescExpanded ? 'rotate-180' : ''
                      )}
                      aria-hidden
                    />
                  </button>
                  {ldescExpanded && (
                    <div className="border-t border-[var(--bg-border)] p-3">
                      <Suspense
                        fallback={
                          <div className={clsx(richEditorSkeletonCls, 'min-h-[320px]')} aria-busy="true" />
                        }
                      >
                        <Controller
                          name="l_description"
                          control={control}
                          render={({ field }) => (
                            <AdminProductRichTextEditor
                              id={ldescEditorId}
                              mountKey={`${richTextEpoch}-ldesc`}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              height={320}
                              maxHeight={800}
                            />
                          )}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isEdit && productProgramsSnapshot ? (
              <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5', 'shadow-[var(--card-shadow)]')}>
                <h2 className="mb-1 text-[18px] font-semibold text-[var(--text-primary)]">
                  Chương trình giá — cấp sản phẩm (SPU)
                </h2>
                <p className="mb-4 text-[12px] leading-snug text-[var(--text-muted)]">
                  Bậc số lượng và chương trình mua kèm của sản phẩm hiển thị ở đây. Đợt giảm giá theo thời gian được gắn theo từng phân loại — xem từng thẻ bên dưới.
                </p>
                <div
                  className={clsx(
                    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/35 p-4',
                    'text-[15px] leading-relaxed text-[var(--text-secondary)]'
                  )}
                >
                  <p className="mb-2 text-base font-semibold text-[var(--text-primary)]">
                    Snapshot API (hiển thị cho khách)
                  </p>
                  {productProgramsSnapshot.fromEffective != null ? (
                    <p className="mb-2">
                      <span className="text-[15px] font-semibold text-[var(--text-muted)]">Card / danh sách (storefront): </span>
                      <span className="font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]">
                        Từ {formatPrice(productProgramsSnapshot.fromEffective)}
                      </span>
                    </p>
                  ) : null}
                  {productProgramsSnapshot.tiers.length > 0 ? (
                    <div className="mb-3">
                      <p className="mb-1 text-[15px] font-semibold text-[var(--text-muted)]">
                        Mix-and-match — <span className="font-[family-name:var(--font-admin-mono)]">volume_price_tiers</span> (theo SP)
                      </p>
                      <p className="mb-2 text-[11px] leading-snug text-[var(--text-muted)]">
                        Mua càng nhiều càng rẻ: tính theo tổng số lượng cùng sản phẩm trên một đơn (không gắn từng dòng variant).
                      </p>
                      <ul className="space-y-1.5">
                        {productProgramsSnapshot.tiers.map((t) => (
                          <li
                            key={t.id}
                            className={clsx(
                              'flex flex-wrap items-baseline gap-x-2 rounded-md border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 py-1.5',
                              !t.enabled && 'opacity-60'
                            )}
                          >
                            <span className="font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]">
                              min_quantity ≥ {t.minQuantity}
                            </span>
                            <span>
                              → <span className="font-[family-name:var(--font-admin-mono)]">unit_price</span> {formatPrice(t.unitPrice)}
                            </span>
                            {!t.enabled ? (
                              <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">(tắt)</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {productProgramsSnapshot.pwp.length > 0 ? (
                    <div className="mb-1">
                      <p className="mb-1 text-[15px] font-semibold text-[var(--text-muted)]">
                        Mua kèm — <span className="font-[family-name:var(--font-admin-mono)]">purchase_with_purchase_programs</span>
                      </p>
                      <ul className="space-y-2">
                        {productProgramsSnapshot.pwp.map((row) => (
                          <li
                            key={row.id}
                            className={clsx(
                              'rounded-md border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 py-1.5',
                              row.enabled === false && 'opacity-60'
                            )}
                          >
                            <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                              Vai trò: {row.role === 'anchor' ? 'Neo (anchor)' : 'Đi kèm (companion)'}
                            </span>
                            {row.enabled === false ? (
                              <span className="ms-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                                (tắt)
                              </span>
                            ) : null}
                            <div className="mt-0.5 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
                              {row.anchorProductId != null ? (
                                <div>
                                  <span className="font-[family-name:var(--font-admin-mono)]">anchor_product_id</span> {row.anchorProductId}
                                  {row.anchorVariantId != null ? (
                                    <span className="text-[var(--text-muted)]">
                                      {' '}
                                      — chỉ khi neo variant <span className="font-[family-name:var(--font-admin-mono)]">ID {row.anchorVariantId}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-muted)]"> — mọi phân loại neo của SP</span>
                                  )}
                                </div>
                              ) : null}
                              {row.companionProductId != null ? (
                                <div>
                                  <span className="font-[family-name:var(--font-admin-mono)]">companion_product_id</span> {row.companionProductId}
                                  {row.companionVariantId != null ? (
                                    <span className="text-[var(--text-muted)]">
                                      {' '}
                                      — chỉ khi đi kèm variant{' '}
                                      <span className="font-[family-name:var(--font-admin-mono)]">ID {row.companionVariantId}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-muted)]"> — mọi phân loại đi kèm của SP</span>
                                  )}
                                </div>
                              ) : null}
                              {row.promoUnitPrice != null ? <div>Giá KM đơn vị: {formatPrice(row.promoUnitPrice)}</div> : null}
                              {row.minAnchorQuantity != null ? <div>Số lượng điều kiện tối thiểu (mỗi bộ): {row.minAnchorQuantity}</div> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--bg-border)] pt-3 text-[14px]">
                    <Link
                      to="/admin/pricing/time-change"
                      className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Giá theo thời gian (PC)
                    </Link>
                    <Link
                      to="/admin/pricing/volume"
                      className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Bậc SL / mix-and-match
                    </Link>
                    <Link
                      to="/admin/pricing/pwp"
                      className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Mua kèm (PwP)
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Card: Phân loại (SKU) & giá catalog */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5', 'shadow-[var(--card-shadow)]')}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Phân loại & giá</h2>
                  <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">
                    Mỗi thẻ là một phân loại của sản phẩm. Đơn hàng và đợt giảm giá được liên kết theo phân loại; mã SKU dùng để hiển thị và quản lý kho.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => appendVariant(emptyVariantFormRow(variantFields.length, defaultCatalogUnitStr))}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Thêm phân loại
                </button>
              </div>
              <div className="space-y-4 pt-3">
                {variantFields.map((vf, idx) => {
                  const rowWatch = variantsWatched[idx];
                  const rawVid = rowWatch?.variantId?.trim();
                  const persistedVid =
                    rawVid && Number.isFinite(Number(rawVid)) && Number(rawVid) > 0 ? Math.trunc(Number(rawVid)) : null;
                  let skuGallerySlot: ReactNode;
                  if (isEdit && detailVariantTabsFromApi) {
                    if (!rawVid) {
                      skuGallerySlot = undefined;
                    } else {
                      const vidNum = Number(rawVid);
                      const snapshot: VariantInitialSnapshot =
                        variantSnapshotById.get(vidNum) ?? {
                          id: vidNum,
                          skuCode: rowWatch?.skuCode?.trim() ?? '',
                          active: Boolean(rowWatch?.active),
                          sortOrder: Number(rowWatch?.sortOrder) || idx,
                          optionValues: optionPairsToRecord(rowWatch?.optionPairs ?? []),
                          prices: [],
                          documents: [],
                        };
                      skuGallerySlot =
                        Number.isFinite(vidNum) && vidNum > 0 ? (
                          <VariantSkuGalleryPanel
                            variantNumericId={vidNum}
                            snapshot={snapshot}
                            draft={variantSkuGalleryById[vidNum] ?? VARIANT_SKU_GALLERY_EMPTY}
                            disabled={saving}
                            onDraftPatch={(p) => patchVariantSkuGallery(vidNum, p)}
                            fieldIdPrefix={`${formDomId}-variant-${idx}`}
                          />
                        ) : undefined;
                    }
                  } else {
                    skuGallerySlot = undefined;
                  }
                  const guestInsight =
                    isEdit && detailVariantTabsFromApi && rawVid
                      ? (() => {
                        const vidNum = Number(rawVid);
                        if (!Number.isFinite(vidNum) || vidNum <= 0) return null;
                        const s = variantSnapshotById.get(vidNum);
                        if (!s) return null;
                        return {
                          effectiveUnitPrice: s.effectiveUnitPrice ?? null,
                          activePriceChange: s.activePriceChange ?? null,
                          variantDbId: vidNum,
                        };
                      })()
                      : null;
                  return (
                    <VariantSkuCard
                      key={vf.id}
                      index={idx}
                      control={control}
                      register={register}
                      variantCount={variantFields.length}
                      defaultCatalogUnitStr={defaultCatalogUnitStr}
                      requireSkuCode={!isEdit || detailVariantTabsFromApi}
                      fieldIdPrefix={`${formDomId}-variant-${idx}`}
                      nestedErrors={errors.variants?.[idx] as FieldErrors<VariantFormValues> | undefined}
                      removeVariant={(i) => { if (variantFields.length > 1) removeVariant(i); }}
                      inputCls={inputCls}
                      invalidOutlineCls={invalidOutlineCls}
                      priceRowLabelCls={priceRowLabelCls}
                      priceRowControlCls={priceRowControlCls}
                      skuMediaFooter={skuGallerySlot}
                      guestPriceInsight={guestInsight}
                      persistedDbVariantId={persistedVid}
                    />
                  );
                })}
              </div>
            </div>

            {/* Card: Ảnh & video */}
            {isEdit ? (
              <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5', 'shadow-[var(--card-shadow)]')}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Ảnh và video</h2>
                  {productQuery.isFetching ? (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Đang làm mới…
                    </span>
                  ) : null}
                </div>

                {visibleMediaItems.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleMediaItems.map((item) => {
                      const replacementSrc =
                        item.documentId != null ? replacePreviewSrcByDocId[item.documentId] : undefined;
                      const previewSrc = replacementSrc ?? galleryImageSrc(item);
                      const isCoverChosen =
                        item.coverEligible &&
                        (draftMainDocumentId != null && item.documentId != null
                          ? item.documentId === draftMainDocumentId
                          : item.isMainCover);
                      const hasPendingReplace =
                        item.documentId != null && item.documentId in pendingReplaceByDocId;
                      return (
                        <li
                          key={item.key}
                          className={clsx(
                            'overflow-hidden rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50',
                            hasPendingReplace ? 'ring-2 ring-[var(--accent)]/55' : ''
                          )}
                        >
                          <div className="relative h-36 w-full bg-black/10">
                            {item.documentId != null ? (
                              <button
                                type="button"
                                className={clsx(
                                  'absolute right-2 top-2 z-20 flex size-7 items-center justify-center rounded-full',
                                  'bg-black/70 text-white shadow-md',
                                  'hover:bg-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                                  'disabled:cursor-not-allowed disabled:opacity-50'
                                )}
                                aria-label={`Xóa "${item.title}"`}
                                disabled={saving}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  markDocumentHiddenUntilSave(item.documentId!);
                                }}
                              >
                                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                              </button>
                            ) : null}
                            {item.isVideo && item.displayUrl ? (
                              <video
                                src={item.displayUrl}
                                className="h-full w-full object-cover"
                                controls
                                preload="metadata"
                                playsInline
                                muted={false}
                              />
                            ) : previewSrc ? (
                              <button
                                type="button"
                                className="relative block h-full w-full cursor-zoom-in border-0 p-0 focus-visible:outline-none"
                                onClick={() => openGalleryAtKey(item.key)}
                                aria-label={`Xem ảnh lớn: ${item.title}`}
                              >
                                <img
                                  src={previewSrc}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  draggable={false}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </button>
                            ) : /^https?:\/\//i.test(item.rawPath) ? (
                              <a
                                href={item.rawPath}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-semibold text-[var(--accent)] underline"
                              >
                                {item.title}
                              </a>
                            ) : (
                              <div className="flex h-full items-center px-3 text-[11px] text-[var(--text-muted)]">
                                <span className="break-all">{item.rawPath}</span>
                              </div>
                            )}
                            {item.isVideo ? (
                              <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Video
                              </span>
                            ) : null}
                            {hasPendingReplace ? (
                              <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-[var(--accent)]/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                                Sẽ thay khi lưu
                              </span>
                            ) : null}
                            {isCoverChosen ? (
                              <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                                Đại diện
                              </span>
                            ) : null}
                          </div>
                          <div className="border-t border-[var(--bg-border)] px-3 py-2 space-y-1.5">
                            <p className="truncate text-[11px] font-medium text-[var(--text-primary)]" title={item.title}>
                              {item.title}
                            </p>
                            {item.documentId != null && item.coverEligible ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => openReplaceImagePicker(item.documentId!)}
                                className={clsx(
                                  'inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold',
                                  'border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-primary)]',
                                  'hover:bg-[var(--bg-elevated)] disabled:opacity-50',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                                )}
                              >
                                <RefreshCw className="size-3 shrink-0 text-[var(--accent)]" aria-hidden />
                                {hasPendingReplace ? 'Đổi file thay thế…' : 'Thay ảnh'}
                              </button>
                            ) : null}
                            {item.coverEligible && item.documentId != null ? (
                              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                <input
                                  type="radio"
                                  name={`product-cover-${pid}`}
                                  checked={
                                    draftMainDocumentId != null
                                      ? item.documentId === draftMainDocumentId
                                      : item.isMainCover
                                  }
                                  disabled={saving}
                                  onChange={() => selectDraftMainDocument(item.documentId!)}
                                  className="size-3.5 shrink-0 accent-[var(--accent)]"
                                />
                                <span>
                                  {draftMainDocumentId === item.documentId || (draftMainDocumentId == null && item.isMainCover)
                                    ? 'Ảnh đại diện ✓'
                                    : 'Đặt làm đại diện'}
                                </span>
                              </label>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--bg-border)] py-10 text-center">
                    <ImagePlus className="mb-2 size-8 text-[var(--text-muted)]" aria-hidden />
                    <p className="text-sm text-[var(--text-secondary)]">Chưa có ảnh hoặc video</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Nhấn «Thêm ảnh/video» để tải lên</p>
                  </div>
                )}

                {/* Pending new media — hiển thị preview blob URL trước khi lưu */}
                {pendingNewMediaPreviews.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Chờ tải lên ({pendingNewMediaPreviews.length} tệp) · Sẽ gửi khi nhấn Lưu
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pendingNewMediaPreviews.map(({ url, name, isMain, index }) => (
                        <li
                          key={`pending-${index}-${name}`}
                          className="overflow-hidden rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-elevated)]/50 ring-1 ring-[var(--accent)]/20"
                        >
                          <div className="relative h-36 w-full bg-black/10">
                            <button
                              type="button"
                              className={clsx(
                                'absolute right-2 top-2 z-20 flex size-7 items-center justify-center rounded-full',
                                'bg-black/70 text-white shadow-md hover:bg-[var(--danger)]',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
                              )}
                              aria-label={`Xóa "${name}" khỏi hàng chờ`}
                              onClick={() => removePendingNewFile(index)}
                            >
                              <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                            </button>
                            {url ? (
                              <img
                                src={url}
                                alt=""
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                                Video
                              </div>
                            )}
                            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-[var(--accent)]/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                              Chờ lưu
                            </span>
                            {isMain && url ? (
                              <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                                Đại diện
                              </span>
                            ) : null}
                          </div>
                          <div className="border-t border-[var(--bg-border)] px-3 py-2">
                            <p className="truncate text-[11px] font-medium text-[var(--text-primary)]" title={name}>
                              {name}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {uploadStaging ? (
                  <div
                    role="region"
                    aria-label="Xác nhận đăng nhiều tệp"
                    className="mt-4 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4"
                  >
                    <p className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">
                      {uploadStaging.files.length} tệp đã chọn — nhấn vào ảnh để đặt làm đại diện:
                    </p>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {uploadStaging.files.map((f, idx) => {
                        const preview = uploadStagingPreviews[idx];
                        const isSelected = uploadStaging.mainFileIndex === idx;
                        const isImg = f.type.startsWith('image/');
                        return (
                          <li key={`${f.name}-${idx}-${f.size}`}>
                            <label
                              className={clsx(
                                'flex flex-col cursor-pointer overflow-hidden rounded-lg border-2 transition-colors',
                                isSelected && isImg
                                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
                                  : 'border-[var(--bg-border)] hover:border-[var(--accent)]/50'
                              )}
                            >
                              <div className="relative h-24 bg-black/10">
                                {preview?.url ? (
                                  <img
                                    src={preview.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                                    {f.type.startsWith('video/') ? 'Video' : 'File'}
                                  </div>
                                )}
                                {isImg ? (
                                  <input
                                    type="radio"
                                    name="staging-upload-main"
                                    className="absolute left-2 top-2 size-4 accent-[var(--accent)]"
                                    checked={isSelected}
                                    onChange={() => setUploadStaging((s) => (s ? { ...s, mainFileIndex: idx } : s))}
                                  />
                                ) : null}
                                {isSelected && isImg ? (
                                  <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-amber-300">
                                    <Star className="size-2.5 fill-amber-400 text-amber-400" aria-hidden />
                                    Đại diện
                                  </span>
                                ) : null}
                              </div>
                              <div className="bg-[var(--bg-elevated)] px-2 py-1">
                                <p className="truncate text-[10px] text-[var(--text-primary)]" title={f.name}>
                                  {f.name}
                                </p>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void confirmUploadStaging()}
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                      >
                        Xác nhận ({uploadStaging.files.length} tệp)
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={cancelUploadStaging}
                        className="rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <input
                    ref={replaceFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => { onReplaceFilePickerChange(e.target.files); e.target.value = ''; }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={(e) => onFilePickerChange(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold',
                      'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    )}
                  >
                    <ImagePlus className="size-4" />
                    Thêm ảnh hoặc video
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* ════ RIGHT / SIDEBAR ════ */}
          <div className="space-y-4">

            {/* Card: Trạng thái */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4', 'shadow-[var(--card-shadow)]')}>
              <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Trạng thái</h2>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={fieldIds.status} className="text-base font-semibold text-[var(--text-secondary)]">
                    Hiển thị trên cửa hàng
                  </label>
                  <select id={fieldIds.status} {...register('status')} className={inputCls}>
                    <option value="1">Đang bán</option>
                    <option value="0">Ngừng bán</option>
                  </select>
                </div>
                <div className="space-y-2 pt-1 border-t border-[var(--bg-border)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={fieldIds.featured}
                      {...register('isFeatured')}
                      className="size-4 shrink-0 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                    />
                    <label htmlFor={fieldIds.featured} className="cursor-pointer text-[18px] text-[var(--text-primary)]">
                      Sản phẩm nổi bật
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={fieldIds.hotSale}
                      {...register('hotSale')}
                      className="size-4 shrink-0 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                    />
                    <label htmlFor={fieldIds.hotSale} className="cursor-pointer text-[18px] text-[var(--text-primary)]">
                      Hot sale
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Danh mục & hãng */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4', 'shadow-[var(--card-shadow)]')}>
              <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Danh mục & hãng</h2>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={fieldIds.category} className="text-base font-semibold text-[var(--text-secondary)]">
                    Danh mục<span className="text-[var(--danger)]"> *</span>
                  </label>
                  <select
                    id={fieldIds.category}
                    {...register('categoryId', {
                      validate: (v) =>
                        v !== '' && Number.isFinite(Number(v)) && Number(v) > 0
                          ? true
                          : 'Hãy chọn danh mục chứa sản phẩm này.',
                    })}
                    disabled={categoriesQuery.isLoading}
                    aria-invalid={errors.categoryId ? true : undefined}
                    aria-required
                    aria-describedby={errors.categoryId ? `${fieldIds.category}-err` : undefined}
                    className={clsx(inputCls, errors.categoryId ? invalidOutlineCls : null)}
                  >
                    <option value="">— Chọn danh mục —</option>
                    {flatCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}&nbsp;(mã {c.id})
                      </option>
                    ))}
                  </select>
                  {errors.categoryId?.message ? (
                    <span id={`${fieldIds.category}-err`} role="alert" className="text-[11px] text-[var(--danger)]">
                      {String(errors.categoryId.message)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={fieldIds.brand} className="text-base font-semibold text-[var(--text-secondary)]">
                    Hãng / thương hiệu
                  </label>
                  <select
                    id={fieldIds.brand}
                    {...register('brandId', {
                      validate: (v) => {
                        const t = String(v ?? '').trim();
                        if (t === '') return true;
                        const n = Number(t);
                        return Number.isFinite(n) && n > 0 ? true : 'Hãy chọn hãng hợp lệ hoặc để trống.';
                      },
                    })}
                    disabled={brandsQuery.isLoading}
                    aria-invalid={errors.brandId ? true : undefined}
                    aria-describedby={
                      brandsQuery.isError
                        ? `${fieldIds.brand}-load-err`
                        : errors.brandId
                          ? `${fieldIds.brand}-err`
                          : undefined
                    }
                    className={clsx(inputCls, errors.brandId ? invalidOutlineCls : null)}
                  >
                    <option value="">— Không gán hãng —</option>
                    {(brandsQuery.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}&nbsp;({b.code})
                      </option>
                    ))}
                  </select>
                  {brandsQuery.isError ? (
                    <span id={`${fieldIds.brand}-load-err`} role="alert" className="text-[11px] text-[var(--danger)]">
                      {getApiErrorMessage(brandsQuery.error, 'Không tải được danh sách hãng.')}
                    </span>
                  ) : errors.brandId?.message ? (
                    <span id={`${fieldIds.brand}-err`} role="alert" className="text-[11px] text-[var(--danger)]">
                      {String(errors.brandId.message)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Card: Tag */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4', 'shadow-[var(--card-shadow)]')}>
              <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Thẻ tag</h2>
              <div
                className="mb-2 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-2.5 py-2"
                aria-label="Danh sách tag"
              >
                {productTags.length === 0 ? (
                  <span className="text-xs text-[var(--text-muted)]">Chưa có tag</span>
                ) : productTags.map((t, idx) => (
                  <span
                    key={`${idx}-${t}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--bg-border)] bg-[var(--bg-surface)] py-0.5 ps-2 pe-1 text-xs font-medium text-[var(--text-primary)]"
                  >
                    <span className="truncate" title={t}>{t}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label={`Gỡ tag ${t}`}
                      onClick={() => removeProductTag(t)}
                    >
                      <X className="size-3 shrink-0" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  id={fieldIds.tagInput}
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitTagDraft(); }
                  }}
                  className={clsx(inputCls, 'flex-1 min-w-0')}
                  placeholder="Nhập tag rồi Enter"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={commitTagDraft}
                  className={clsx(
                    'shrink-0 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-sm font-semibold',
                    'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Card: Mã định danh */}
            <div className={clsx('rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4', 'shadow-[var(--card-shadow)]')}>
              <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Mã định danh</h2>
              <div className="space-y-3">
                {isEdit ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-base font-semibold text-[var(--text-secondary)]">Mã nội bộ (ID)</label>
                    <div className={clsx(inputCls, 'cursor-default bg-[var(--bg-elevated)]/80 tabular-nums text-[var(--text-muted)]')}>
                      {pid}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <label htmlFor={fieldIds.skuSpu} className="text-base font-semibold text-[var(--text-secondary)]">
                    SKU (SPU — số)
                  </label>
                  <input
                    id={fieldIds.skuSpu}
                    {...register('sku', {
                      validate: (v) => {
                        const raw = String(v ?? '').trim();
                        if (raw === '') return true;
                        const n = Number(raw);
                        return Number.isFinite(n) && Number.isInteger(n) && n > 0
                          ? true
                          : 'SKU phải là số nguyên dương (hoặc để trống).';
                      },
                    })}
                    type="number"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={errors.sku ? true : undefined}
                    aria-describedby={errors.sku ? `${fieldIds.skuSpu}-err` : undefined}
                    className={clsx(inputCls, errors.sku ? invalidOutlineCls : null)}
                    placeholder="Ví dụ: 10000001"
                  />
                  {errors.sku?.message ? (
                    <span id={`${fieldIds.skuSpu}-err`} role="alert" className="text-[11px] text-[var(--danger)]">
                      {String(errors.sku.message)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom save row */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className={clsx(
              'inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white',
              'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
          </button>
          <Link
            to="/admin/products"
            className={clsx(
              'inline-flex items-center justify-center rounded-lg border border-[var(--bg-border)] px-5 py-2.5 text-sm font-semibold',
              'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            Hủy
          </Link>
        </div>
      </form>

      {/* ── Lightbox ── */}
      {isEdit &&
        previewIndex !== null &&
        galleryImageSlides.length > 0 &&
        galleryImageSlides[previewIndex] ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-media-lightbox-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/88"
            aria-label="Đóng"
            onClick={closeGallery}
          />
          <div className="relative z-[2] flex max-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1320px)] flex-col items-center">
            <button
              type="button"
              className={clsx(
                'absolute -right-1 -top-12 z-30 rounded-full bg-white/15 p-2 text-white',
                'hover:bg-white/25 sm:right-0 sm:top-2'
              )}
              aria-label="Đóng"
              onClick={closeGallery}
            >
              <X className="size-6 shrink-0" strokeWidth={2} />
            </button>
            {galleryImageSlides.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/55 p-3 text-white shadow-lg hover:bg-black/75 sm:left-2"
                  aria-label="Ảnh trước"
                  onClick={() =>
                    setPreviewIndex((i) => {
                      const n = galleryImageSlides.length;
                      if (i == null) return n - 1;
                      return i <= 0 ? n - 1 : i - 1;
                    })
                  }
                >
                  <ChevronLeft className="size-7" strokeWidth={2.2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/55 p-3 text-white shadow-lg hover:bg-black/75 sm:right-2"
                  aria-label="Ảnh sau"
                  onClick={() =>
                    setPreviewIndex((i) => {
                      const n = galleryImageSlides.length;
                      if (i == null) return 0;
                      return i + 1 >= n ? 0 : i + 1;
                    })
                  }
                >
                  <ChevronRight className="size-7" strokeWidth={2.2} aria-hidden />
                </button>
              </>
            ) : null}
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center rounded-lg bg-black/40 p-2 shadow-2xl ring-1 ring-white/10">
              <img
                src={galleryImageSlides[previewIndex]!.src}
                alt=""
                className="max-h-[min(85vh,920px)] max-w-full rounded object-contain"
                draggable={false}
              />
            </div>
            <p
              id="product-media-lightbox-title"
              className="mt-4 max-w-full truncate px-2 text-center text-sm text-white/95"
            >
              {galleryImageSlides[previewIndex]!.title}
              {galleryImageSlides.length > 1 ? (
                <span className="ms-2 text-white/70">
                  ({previewIndex + 1}/{galleryImageSlides.length})
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={gallerySaveConfirmOpen}
        title={
          productLoaded?.productName?.trim()
            ? `Lưu thay đổi cho "${productLoaded.productName.trim()}"?`
            : 'Lưu thay đổi cho sản phẩm này?'
        }
        message={
          productLoaded?.productName?.trim()
            ? `Bạn vừa chỉnh ảnh, video đại diện hoặc các hình khác của sản phẩm "${productLoaded.productName.trim()}". Sau khi xác nhận, toàn bộ thông tin bạn đã nhập (tên, mô tả, trạng thái…) và các hình được chọn sẽ được lưu và hiển thị cho khách trên cửa hàng.`
            : `Bạn vừa chỉnh ảnh hoặc video của sản phẩm. Sau khi xác nhận, thông tin bạn đã nhập và các hình được chọn sẽ được lưu và hiển thị cho khách trên cửa hàng.`
        }
        confirmLabel="Lưu và xác nhận"
        cancelLabel="Hủy"
        confirmVariant="profilePrimary"
        confirmLoading={saving}
        onConfirm={() => void confirmGalleryThenSave()}
        onCancel={() => {
          if (saving) return;
          pendingGallerySaveValuesRef.current = null;
          setGallerySaveConfirmOpen(false);
        }}
      />
    </div>
  );
}

import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse, PaginationMetadata } from '../types/common.types';
import type {
  CreateProductRequest,
  ProductFullResponse,
  ProductPrice,
  ProductPriceChange,
  ProductPriceChangeUpsert,
  ProductPriceUpsertRequest,
  ProductVariantPriceRef,
  UpdateProductRequest,
} from '../types/product.types';

export type VolumePriceTier = {
  id: number;
  productId: number;
  minQuantity: number;
  unitPrice: number;
  enabled: boolean;
};

export interface AdminProductsListResult {
  products: ProductFullResponse[];
  metadata: PaginationMetadata | null;
  message: string;
}

function unwrapList(data: ApiResponse<ProductFullResponse[]>): AdminProductsListResult {
  return {
    products: Array.isArray(data.data) ? data.data : [],
    metadata: (data.metadata as PaginationMetadata | undefined) ?? null,
    message: typeof data.message === 'string' ? data.message : '',
  };
}

function normalizeCatalogPrice(raw: unknown): ProductPrice {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Phản hồi giá catalog không hợp lệ');
  }
  const o = raw as Record<string, unknown>;

  let variant: ProductVariantPriceRef | undefined;
  const variantRaw = o.variant;
  if (variantRaw != null && typeof variantRaw === 'object') {
    const v = variantRaw as Record<string, unknown>;
    const vid = Number(v.id);
    const skuRaw = v.skuCode ?? v.sku_code;
    variant = {
      id: Number.isFinite(vid) ? vid : 0,
      skuCode:
        typeof skuRaw === 'string'
          ? skuRaw
          : skuRaw != null && String(skuRaw).trim() !== ''
            ? String(skuRaw)
            : null,
    };
  }

  const pvidRaw = o.productVariantId ?? o.product_variant_id;
  let productVariantId: number | null =
    pvidRaw != null && pvidRaw !== '' && Number.isFinite(Number(pvidRaw)) ? Number(pvidRaw) : null;
  if ((productVariantId == null || productVariantId <= 0) && variant != null && variant.id > 0) {
    productVariantId = variant.id;
  }

  const id = Number(o.id);
  const currentValue = Number(o.currentValue ?? o.current_value);
  const oldRaw = o.oldValue ?? o.old_value;
  const oldValue = oldRaw == null || oldRaw === '' ? null : Number(oldRaw);
  const unitId = Number(o.unitId ?? o.unit_id);
  const unitName = String(o.unitName ?? o.unit_name ?? '');
  const unitRatio = Number(o.unitRatio ?? o.unit_ratio ?? 1);

  return {
    id: Number.isFinite(id) ? id : 0,
    currentValue: Number.isFinite(currentValue) ? currentValue : 0,
    oldValue: oldValue != null && Number.isFinite(oldValue) ? oldValue : null,
    unitId: Number.isFinite(unitId) ? unitId : 0,
    unitName,
    unitRatio: Number.isFinite(unitRatio) ? unitRatio : 1,
    productVariantId: productVariantId != null && productVariantId > 0 ? productVariantId : null,
    variant: variant ?? undefined,
  };
}

function priceChangeInstantToIso(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = Math.abs(v) < 1e11 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function priceChangeEndToIsoOrNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  const iso = priceChangeInstantToIso(v);
  return iso === '' ? null : iso;
}

function normalizePriceChange(
  raw: unknown,
  fallbackVariantId?: number,
  fallbackProductId?: number
): ProductPriceChange {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Phản hồi price change không hợp lệ');
  }
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const rawProductId = Number(o.productId ?? o.product_id);
  let productId = Number.isFinite(rawProductId) && rawProductId > 0 ? rawProductId : 0;
  if (productId <= 0 && fallbackProductId != null) {
    const fb = Number(fallbackProductId);
    if (Number.isFinite(fb) && fb > 0) productId = fb;
  }
  const pvidRaw = o.productVariantId ?? o.product_variant_id;
  let productVariantId =
    pvidRaw != null && pvidRaw !== '' && Number.isFinite(Number(pvidRaw)) ? Number(pvidRaw) : null;
  if ((productVariantId == null || productVariantId <= 0) && fallbackVariantId != null && fallbackVariantId > 0) {
    productVariantId = fallbackVariantId;
  }
  const basePrice = Number(o.basePrice ?? o.base_price ?? 0);
  const saleRaw = o.salePrice ?? o.sale_price;
  const salePrice =
    saleRaw == null || saleRaw === ''
      ? null
      : Number.isFinite(Number(saleRaw))
        ? Number(saleRaw)
        : null;
  const startRaw = o.startAt ?? o.start_at;
  let startAt = priceChangeInstantToIso(startRaw);
  if (startAt === '') startAt = new Date().toISOString();
  const endAt = priceChangeEndToIsoOrNull(o.endAt ?? o.end_at);
  const en = o.enabled;
  const enabled = !(en === false || en === 0 || en === 'false');

  return {
    id: Number.isFinite(id) ? id : 0,
    productId,
    productVariantId: productVariantId != null && productVariantId > 0 ? productVariantId : null,
    basePrice: Number.isFinite(basePrice) ? basePrice : 0,
    salePrice,
    startAt,
    endAt,
    enabled,
  };
}

function assertPositiveProductId(id: number | string, context: string): number {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${context}: productId không hợp lệ (${String(id)}).`);
  }
  return n;
}

/** BE chỉ map `.../products/{id}/variants/{variantId}/price-changes` — không gọi path SPU. */
function assertPriceChangeVariantId(v: number | string | null | undefined): number {
  if (v == null || String(v).trim() === '') {
    throw new Error(
      'Price change bắt buộc id phân loại (SKU). Path: /admin/products/{productId}/variants/{variantId}/price-changes'
    );
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('variantId không hợp lệ cho price change.');
  }
  return n;
}

export const adminProductService = {
  async list(params: {
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<AdminProductsListResult> {
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.ADMIN.PRODUCTS,
      {
        params: { page: params.page ?? 0, limit: params.limit ?? 10 },
        signal: params.signal,
      }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách sản phẩm'
      );
    }
    return unwrapList(data);
  },

  async listByCategory(
    categoryId: number,
    params: { page?: number; limit?: number; signal?: AbortSignal }
  ): Promise<AdminProductsListResult> {
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.ADMIN.PRODUCTS_BY_CATEGORY(categoryId),
      {
        params: { page: params.page ?? 0, limit: params.limit ?? 20 },
        signal: params.signal,
      }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được sản phẩm theo danh mục'
      );
    }
    return unwrapList(data);
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<ProductFullResponse> {
    assertPositiveProductId(id, 'getById');
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse>>(
      API_ENDPOINTS.ADMIN.PRODUCT_BY_ID(id),
      { signal }
    );
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tìm thấy sản phẩm'
      );
    }
    return data.data;
  },

  async create(body: CreateProductRequest, signal?: AbortSignal): Promise<ProductFullResponse> {
    const { data } = await axiosInstance.post<ApiResponse<ProductFullResponse>>(
      API_ENDPOINTS.ADMIN.PRODUCTS,
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo sản phẩm thất bại'
      );
    }
    return data.data;
  },

  async update(
    id: number | string,
    body: UpdateProductRequest,
    signal?: AbortSignal
  ): Promise<ProductFullResponse> {
    const { data } = await axiosInstance.put<ApiResponse<ProductFullResponse>>(
      API_ENDPOINTS.ADMIN.PRODUCT_BY_ID(id),
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật thất bại'
      );
    }
    return data.data;
  },

  /**
   * `PUT multipart` — part `product` (chuỗi JSON `UpdateProductRequest`) và `newImages` (lặp field).
   * @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §1.2 §5
   */
  /**
   * `POST multipart` ảnh cho một SKU — `newImages` (lặp field); query `mainNewImageIndex` tùy chọn.
   * @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4.1
   */
  async uploadVariantImages(
    productId: number | string,
    variantId: number | string,
    opts: { files: File[]; mainNewImageIndex?: number; signal?: AbortSignal }
  ): Promise<ProductFullResponse> {
    const fd = new FormData();
    for (const file of opts.files) {
      fd.append('newImages', file);
    }
    const { data } = await axiosInstance.post<ApiResponse<ProductFullResponse>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VARIANT_IMAGES(productId, variantId),
      fd,
      {
        signal: opts.signal,
        params:
          opts.mainNewImageIndex !== undefined ? { mainNewImageIndex: opts.mainNewImageIndex } : {},
      }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tải ảnh phân loại thất bại'
      );
    }
    return data.data;
  },

  async updateMultipart(
    id: number | string,
    body: UpdateProductRequest,
    opts?: { newImages?: File[]; signal?: AbortSignal }
  ): Promise<ProductFullResponse> {
    const fd = new FormData();
    fd.append('product', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    for (const file of opts?.newImages ?? []) {
      fd.append('newImages', file);
    }
    const { data } = await axiosInstance.put<ApiResponse<ProductFullResponse>>(
      API_ENDPOINTS.ADMIN.PRODUCT_BY_ID(id),
      fd,
      { signal: opts?.signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật thất bại'
      );
    }
    return data.data;
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.PRODUCT_BY_ID(id), {
      signal,
    });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa thất bại');
    }
  },

  async listVolumePriceTiers(
    productId: number | string,
    signal?: AbortSignal
  ): Promise<VolumePriceTier[]> {
    const { data } = await axiosInstance.get<ApiResponse<VolumePriceTier[]>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VOLUME_PRICE_TIERS(productId),
      { signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được bậc giá theo số lượng'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async replaceVolumePriceTiers(
    productId: number | string,
    tiers: Array<{ minQuantity: number; unitPrice: number; enabled: boolean }>,
    signal?: AbortSignal
  ): Promise<VolumePriceTier[]> {
    const { data } = await axiosInstance.put<ApiResponse<VolumePriceTier[]>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VOLUME_PRICE_TIERS(productId),
      tiers,
      { signal }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật bậc giá thất bại'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async listCatalogPrices(productId: number | string, signal?: AbortSignal): Promise<ProductPrice[]> {
    const { data } = await axiosInstance.get<ApiResponse<ProductPrice[]>>(API_ENDPOINTS.ADMIN.PRODUCT_PRICES(productId), {
      signal,
    });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Không tải được giá catalog'
      );
    }
    return Array.isArray(data.data) ? data.data.map(normalizeCatalogPrice) : [];
  },

  async createCatalogPrice(
    productId: number | string,
    body: ProductPriceUpsertRequest,
    signal?: AbortSignal
  ): Promise<ProductPrice> {
    const { data } = await axiosInstance.post<ApiResponse<ProductPrice>>(
      API_ENDPOINTS.ADMIN.PRODUCT_PRICES(productId),
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo giá catalog thất bại');
    }
    return normalizeCatalogPrice(data.data);
  },

  async updateCatalogPrice(
    productId: number | string,
    priceId: number | string,
    body: ProductPriceUpsertRequest,
    signal?: AbortSignal
  ): Promise<ProductPrice> {
    const { data } = await axiosInstance.put<ApiResponse<ProductPrice>>(
      API_ENDPOINTS.ADMIN.PRODUCT_PRICE_BY_ID(productId, priceId),
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật giá catalog thất bại'
      );
    }
    return normalizeCatalogPrice(data.data);
  },

  async deleteCatalogPrice(productId: number | string, priceId: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(
      API_ENDPOINTS.ADMIN.PRODUCT_PRICE_BY_ID(productId, priceId),
      { signal }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa giá catalog thất bại');
    }
  },

  async listPriceChanges(
    productId: number | string,
    opts: { variantId: number | string; signal?: AbortSignal }
  ): Promise<ProductPriceChange[]> {
    const pid = assertPositiveProductId(productId, 'listPriceChanges');
    const variantId = assertPriceChangeVariantId(opts.variantId);
    const { data } = await axiosInstance.get<ApiResponse<ProductPriceChange[]>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VARIANT_PRICE_CHANGES(pid, variantId),
      { signal: opts.signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được lịch sử giá'
      );
    }
    return Array.isArray(data.data)
      ? data.data.map((row) => normalizePriceChange(row, variantId, pid))
      : [];
  },

  async createPriceChange(
    productId: number | string,
    body: ProductPriceChangeUpsert,
    opts: { variantId: number | string; signal?: AbortSignal }
  ): Promise<ProductPriceChange> {
    const pid = assertPositiveProductId(productId, 'createPriceChange');
    const variantId = assertPriceChangeVariantId(opts.variantId);
    const { data } = await axiosInstance.post<ApiResponse<ProductPriceChange>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VARIANT_PRICE_CHANGES(pid, variantId),
      body,
      { signal: opts.signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo price change thất bại'
      );
    }
    return normalizePriceChange(data.data, variantId, pid);
  },

  async updatePriceChange(
    productId: number | string,
    priceChangeId: number | string,
    body: ProductPriceChangeUpsert,
    opts: { variantId: number | string; signal?: AbortSignal }
  ): Promise<ProductPriceChange> {
    const pid = assertPositiveProductId(productId, 'updatePriceChange');
    const variantId = assertPriceChangeVariantId(opts.variantId);
    const { data } = await axiosInstance.put<ApiResponse<ProductPriceChange>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VARIANT_PRICE_CHANGE_BY_ID(pid, variantId, priceChangeId),
      body,
      { signal: opts.signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật price change thất bại'
      );
    }
    return normalizePriceChange(data.data, variantId, pid);
  },

  async deletePriceChange(
    productId: number | string,
    priceChangeId: number | string,
    opts: { variantId: number | string; signal?: AbortSignal }
  ): Promise<void> {
    const pid = assertPositiveProductId(productId, 'deletePriceChange');
    const variantId = assertPriceChangeVariantId(opts.variantId);
    const { data } = await axiosInstance.delete<ApiResponse<null>>(
      API_ENDPOINTS.ADMIN.PRODUCT_VARIANT_PRICE_CHANGE_BY_ID(pid, variantId, priceChangeId),
      { signal: opts.signal }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa price change thất bại');
    }
  },
};

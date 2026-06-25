import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';
import { downloadTemplateBlob, postImportFile } from './importHelpers';
import type { PurchaseWithPurchaseOffer, PurchaseWithPurchaseOfferUpsert } from '../types/promotion.types';
import type { ProductPriceChange } from '../types/product.types';
import type { VolumePriceTier } from './adminProductService';

/** Chuẩn hóa 1 bậc giá volume từ BE (hỗ trợ cả snake_case product_id / product_variant_id). */
function normalizeVolumeTier(raw: unknown): VolumePriceTier {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pid = Number(o.productId ?? o.product_id);
  const vid = Number(o.productVariantId ?? o.product_variant_id);
  return {
    id: Number(o.id),
    productId: Number.isFinite(pid) && pid > 0 ? pid : 0,
    productVariantId: Number.isFinite(vid) && vid > 0 ? vid : null,
    minQuantity: Number(o.minQuantity ?? o.min_quantity ?? 0),
    unitPrice: Number(o.unitPrice ?? o.unit_price ?? 0),
    enabled: Boolean(o.enabled),
  };
}

export const adminPromotionService = {
  async listPurchaseWithPurchase(signal?: AbortSignal): Promise<PurchaseWithPurchaseOffer[]> {
    const { data } = await axiosInstance.get<ApiResponse<PurchaseWithPurchaseOffer[]>>(
      API_ENDPOINTS.ADMIN.PWP_OFFERS,
      { signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách PwP'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async createPurchaseWithPurchase(
    body: PurchaseWithPurchaseOfferUpsert,
    signal?: AbortSignal
  ): Promise<PurchaseWithPurchaseOffer> {
    const { data } = await axiosInstance.post<ApiResponse<PurchaseWithPurchaseOffer>>(
      API_ENDPOINTS.ADMIN.PWP_OFFERS,
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo PwP thất bại'
      );
    }
    return data.data;
  },

  async updatePurchaseWithPurchase(
    id: number | string,
    body: PurchaseWithPurchaseOfferUpsert,
    signal?: AbortSignal
  ): Promise<PurchaseWithPurchaseOffer> {
    const { data } = await axiosInstance.put<ApiResponse<PurchaseWithPurchaseOffer>>(
      API_ENDPOINTS.ADMIN.PWP_OFFER_BY_ID(id),
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật PwP thất bại'
      );
    }
    return data.data;
  },

  async deletePurchaseWithPurchase(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.PWP_OFFER_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa PwP thất bại'
      );
    }
  },

  // ── Tổng quan: liệt kê tất cả sản phẩm đang chạy chương trình ────────────

  /** Tất cả chương trình đổi giá theo thời gian (mọi sản phẩm/biến thể). */
  async listAllPriceChanges(signal?: AbortSignal): Promise<ProductPriceChange[]> {
    const { data } = await axiosInstance.get<ApiResponse<ProductPriceChange[]>>(
      API_ENDPOINTS.ADMIN.PROMO_PRICE_CHANGES_ALL,
      { signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách chương trình đổi giá'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  /** Tất cả bậc giá theo số lượng (Mix & Match) của mọi sản phẩm/biến thể. */
  async listAllVolumeTiers(signal?: AbortSignal): Promise<VolumePriceTier[]> {
    const { data } = await axiosInstance.get<ApiResponse<unknown[]>>(
      API_ENDPOINTS.ADMIN.PROMO_VOLUME_TIERS_ALL,
      { signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách bậc giá'
      );
    }
    return Array.isArray(data.data) ? data.data.map(normalizeVolumeTier) : [];
  },

  // ── Import bằng Excel/CSV/TXT ────────────────────────────────────────────

  /** Import chương trình đổi giá (PC) từ file. */
  async importPriceChanges(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postImportFile(API_ENDPOINTS.ADMIN.PROMO_PRICE_CHANGE_IMPORT, file, 'Nhập chương trình đổi giá thất bại', signal);
  },
  async downloadPriceChangeTemplate(signal?: AbortSignal): Promise<Blob> {
    return downloadTemplateBlob(API_ENDPOINTS.ADMIN.PROMO_PRICE_CHANGE_IMPORT_TEMPLATE, signal);
  },

  /** Import chương trình mua kèm (PWP) từ file. */
  async importPurchaseWithPurchase(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postImportFile(API_ENDPOINTS.ADMIN.PROMO_PWP_IMPORT, file, 'Nhập chương trình mua kèm thất bại', signal);
  },
  async downloadPwpTemplate(signal?: AbortSignal): Promise<Blob> {
    return downloadTemplateBlob(API_ENDPOINTS.ADMIN.PROMO_PWP_IMPORT_TEMPLATE, signal);
  },

  /** Import giá theo số lượng (Mix & Match / Volume tier) từ file. */
  async importVolumeTiers(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postImportFile(API_ENDPOINTS.ADMIN.PROMO_VOLUME_TIER_IMPORT, file, 'Nhập giá theo số lượng thất bại', signal);
  },
  async downloadVolumeTierTemplate(signal?: AbortSignal): Promise<Blob> {
    return downloadTemplateBlob(API_ENDPOINTS.ADMIN.PROMO_VOLUME_TIER_IMPORT_TEMPLATE, signal);
  },
};


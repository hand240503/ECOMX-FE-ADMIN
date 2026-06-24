import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';
import { downloadTemplateBlob, postImportFile } from './importHelpers';
import type { PurchaseWithPurchaseOffer, PurchaseWithPurchaseOfferUpsert } from '../types/promotion.types';

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


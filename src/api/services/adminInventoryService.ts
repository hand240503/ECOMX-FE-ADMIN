import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';
import { downloadTemplateBlob, postImportFile } from './importHelpers';
import type {
  InventoryAdjustRequest,
  InventoryImportRequest,
  InventoryLedgerResponse,
  InventoryStockResponse,
} from '../types/inventory.types';

/**
 * Admin quản lý tồn kho ĐA KHO — `/{api.prefix}/admin/inventory`.
 * Tồn kho ở cấp (kho × biến thể). @see docs/QUAN_LY_KHO_HANG.md
 */
export const adminInventoryService = {
  /** Tồn của tất cả biến thể trong MỘT kho. */
  async listStocks(storeId: number, q?: string, signal?: AbortSignal): Promise<InventoryStockResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStockResponse[]>>(
      API_ENDPOINTS.ADMIN.INVENTORY_STOCKS,
      { params: { storeId, ...(q && q.trim() ? { q: q.trim() } : {}) }, signal }
    );
    if (data.success === false) {
      throw new Error(data.message?.trim() || 'Không tải được danh sách tồn kho');
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  /** Tồn của một biến thể tại tất cả các kho. */
  async listStocksByVariant(variantId: number, signal?: AbortSignal): Promise<InventoryStockResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStockResponse[]>>(
      API_ENDPOINTS.ADMIN.INVENTORY_VARIANT_STORES(variantId),
      { signal }
    );
    if (data.success === false) {
      throw new Error(data.message?.trim() || 'Không tải được tồn kho theo kho');
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async getStock(storeId: number, variantId: number, signal?: AbortSignal): Promise<InventoryStockResponse> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStockResponse>>(
      API_ENDPOINTS.ADMIN.INVENTORY_STORE_VARIANT_STOCK(storeId, variantId),
      { signal }
    );
    if (data.success === false || data.data == null) {
      throw new Error(data.message?.trim() || 'Không tìm thấy tồn kho biến thể');
    }
    return data.data;
  },

  async getLedger(storeId: number, variantId: number, signal?: AbortSignal): Promise<InventoryLedgerResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryLedgerResponse[]>>(
      API_ENDPOINTS.ADMIN.INVENTORY_STORE_VARIANT_LEDGER(storeId, variantId),
      { signal }
    );
    if (data.success === false) {
      throw new Error(data.message?.trim() || 'Không tải được lịch sử kho');
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async importStock(body: InventoryImportRequest, signal?: AbortSignal): Promise<InventoryStockResponse> {
    const { data } = await axiosInstance.post<ApiResponse<InventoryStockResponse>>(
      API_ENDPOINTS.ADMIN.INVENTORY_IMPORT,
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(errMsg?.trim() || 'Nhập kho thất bại');
    }
    return data.data;
  },

  async adjustStock(body: InventoryAdjustRequest, signal?: AbortSignal): Promise<InventoryStockResponse> {
    const { data } = await axiosInstance.post<ApiResponse<InventoryStockResponse>>(
      API_ENDPOINTS.ADMIN.INVENTORY_ADJUST,
      body,
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(errMsg?.trim() || 'Điều chỉnh tồn kho thất bại');
    }
    return data.data;
  },

  /** Import tồn kho hàng loạt vào MỘT kho từ file Excel/CSV/TXT. */
  async importExcel(storeId: number, file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postImportFile(
      `${API_ENDPOINTS.ADMIN.INVENTORY_IMPORT_EXCEL}?storeId=${storeId}`,
      file,
      'Nhập tồn kho thất bại',
      signal
    );
  },

  /** Tải file Excel mẫu để nhập tồn kho. */
  async downloadImportTemplate(signal?: AbortSignal): Promise<Blob> {
    return downloadTemplateBlob(API_ENDPOINTS.ADMIN.INVENTORY_IMPORT_TEMPLATE, signal);
  },
};

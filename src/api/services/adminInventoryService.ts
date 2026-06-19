import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type {
  InventoryAdjustRequest,
  InventoryImportRequest,
  InventoryLedgerResponse,
  InventoryStockResponse,
} from '../types/inventory.types';

/**
 * Admin quản lý kho — `/{api.prefix}/admin/inventory`.
 * Tồn kho ở cấp biến thể (SKU). @see docs/QUAN_LY_KHO_HANG.md
 */
export const adminInventoryService = {
  async listStocks(q?: string, signal?: AbortSignal): Promise<InventoryStockResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStockResponse[]>>(
      API_ENDPOINTS.ADMIN.INVENTORY_STOCKS,
      { params: q && q.trim() ? { q: q.trim() } : undefined, signal }
    );
    if (data.success === false) {
      throw new Error(data.message?.trim() || 'Không tải được danh sách tồn kho');
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async getStock(variantId: number, signal?: AbortSignal): Promise<InventoryStockResponse> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStockResponse>>(
      API_ENDPOINTS.ADMIN.INVENTORY_VARIANT_STOCK(variantId),
      { signal }
    );
    if (data.success === false || data.data == null) {
      throw new Error(data.message?.trim() || 'Không tìm thấy tồn kho biến thể');
    }
    return data.data;
  },

  async getLedger(variantId: number, signal?: AbortSignal): Promise<InventoryLedgerResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryLedgerResponse[]>>(
      API_ENDPOINTS.ADMIN.INVENTORY_VARIANT_LEDGER(variantId),
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
};

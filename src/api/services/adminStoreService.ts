import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type {
  StoreResponse,
  StoreCreateRequest,
  StoreUpdateRequest,
  StockTransferRequest,
} from '../types/store.types';

/**
 * Admin quản lý kho / cửa hàng — `/{api.prefix}/admin/stores`.
 * CRUD kho + chuyển hàng giữa các kho. Yêu cầu quyền MODULE_STORE (250xxx).
 */
export const adminStoreService = {
  async list(q?: string, signal?: AbortSignal): Promise<StoreResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<StoreResponse[]>>(API_ENDPOINTS.ADMIN.STORES, {
      params: q && q.trim() ? { q: q.trim() } : undefined,
      signal,
    });
    if (data.success === false) throw new Error(data.message?.trim() || 'Không tải được danh sách kho');
    return Array.isArray(data.data) ? data.data : [];
  },

  async get(id: number, signal?: AbortSignal): Promise<StoreResponse> {
    const { data } = await axiosInstance.get<ApiResponse<StoreResponse>>(API_ENDPOINTS.ADMIN.STORE_BY_ID(id), { signal });
    if (data.success === false || data.data == null) throw new Error(data.message?.trim() || 'Không tìm thấy kho');
    return data.data;
  },

  async create(body: StoreCreateRequest, signal?: AbortSignal): Promise<StoreResponse> {
    const { data } = await axiosInstance.post<ApiResponse<StoreResponse>>(API_ENDPOINTS.ADMIN.STORES, body, { signal });
    if (data.success === false || data.data == null) {
      throw new Error(data.errors?.[0]?.message ?? data.message?.trim() ?? 'Tạo kho thất bại');
    }
    return data.data;
  },

  async update(id: number, body: StoreUpdateRequest, signal?: AbortSignal): Promise<StoreResponse> {
    const { data } = await axiosInstance.put<ApiResponse<StoreResponse>>(API_ENDPOINTS.ADMIN.STORE_BY_ID(id), body, { signal });
    if (data.success === false || data.data == null) {
      throw new Error(data.errors?.[0]?.message ?? data.message?.trim() ?? 'Cập nhật kho thất bại');
    }
    return data.data;
  },

  async remove(id: number, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<void>>(API_ENDPOINTS.ADMIN.STORE_BY_ID(id), { signal });
    if (data.success === false) {
      throw new Error(data.errors?.[0]?.message ?? data.message?.trim() ?? 'Xoá kho thất bại');
    }
  },

  async transfer(body: StockTransferRequest, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.post<ApiResponse<void>>(API_ENDPOINTS.ADMIN.STORE_TRANSFER, body, { signal });
    if (data.success === false) {
      throw new Error(data.errors?.[0]?.message ?? data.message?.trim() ?? 'Chuyển kho thất bại');
    }
  },
};

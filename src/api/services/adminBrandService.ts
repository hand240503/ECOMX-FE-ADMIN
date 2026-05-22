import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { BrandResponse, CreateBrandRequest, UpdateBrandRequest } from '../types/brand.types';

/**
 * Admin brands CRUD — `/{api.prefix}/admin/brands`.
 * Quyền catalogue chuẩn: 100xxx; legacy: 170xxx. @see docs/ADMIN_PERMISSION_CATALOG_FE.md
 * @see docs/ADMIN_BRANDS.md
 */
export const adminBrandService = {
  async list(signal?: AbortSignal): Promise<BrandResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<BrandResponse[]>>(API_ENDPOINTS.ADMIN.BRANDS, { signal });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách hãng'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<BrandResponse> {
    const { data } = await axiosInstance.get<ApiResponse<BrandResponse>>(API_ENDPOINTS.ADMIN.BRAND_BY_ID(id), {
      signal,
    });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Không tìm thấy hãng'
      );
    }
    return data.data;
  },

  async create(body: CreateBrandRequest, signal?: AbortSignal): Promise<BrandResponse> {
    const { data } = await axiosInstance.post<ApiResponse<BrandResponse>>(API_ENDPOINTS.ADMIN.BRANDS, body, { signal });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo hãng thất bại');
    }
    return data.data;
  },

  async update(id: number | string, body: UpdateBrandRequest, signal?: AbortSignal): Promise<BrandResponse> {
    const { data } = await axiosInstance.put<ApiResponse<BrandResponse>>(API_ENDPOINTS.ADMIN.BRAND_BY_ID(id), body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật hãng thất bại'
      );
    }
    return data.data;
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.BRAND_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa hãng thất bại');
    }
  },
};

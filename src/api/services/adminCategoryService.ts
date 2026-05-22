import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from '../types/category.types';

/**
 * Admin categories CRUD — `/{api.prefix}/admin/categories`.
 * Quyền catalogue chuẩn: 100xxx; legacy: 200xxx. @see docs/ADMIN_PERMISSION_CATALOG_FE.md
 * @see docs/ADMIN_CATEGORIES.md
 */
export const adminCategoryService = {
  async list(signal?: AbortSignal): Promise<CategoryResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse[]>>(API_ENDPOINTS.ADMIN.CATEGORIES, {
      signal,
    });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách danh mục'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<CategoryResponse> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse>>(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID(id), {
      signal,
    });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tìm thấy danh mục'
      );
    }
    return data.data;
  },

  async create(body: CreateCategoryRequest, signal?: AbortSignal): Promise<CategoryResponse> {
    const { data } = await axiosInstance.post<ApiResponse<CategoryResponse>>(API_ENDPOINTS.ADMIN.CATEGORIES, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo danh mục thất bại');
    }
    return data.data;
  },

  async update(id: number | string, body: UpdateCategoryRequest, signal?: AbortSignal): Promise<CategoryResponse> {
    const { data } = await axiosInstance.put<ApiResponse<CategoryResponse>>(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID(id), body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật danh mục thất bại'
      );
    }
    return data.data;
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa danh mục thất bại');
    }
  },
};

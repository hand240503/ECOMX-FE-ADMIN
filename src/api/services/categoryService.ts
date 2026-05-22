import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CategoryResponse } from '../types/category.types';

/** JWT. Mapping với luồng Home → category: docs/home-category-product-list-flow.md */
export const categoryService = {
  /** Bước 1 (sidebar Home): `GET /categories/roots` */
  async getRootCategories(signal?: AbortSignal): Promise<CategoryResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse[]>>(
      API_ENDPOINTS.CATEGORY.ROOTS,
      { signal }
    );
    const list = data?.data;
    return Array.isArray(list) ? list : [];
  },

  /** Bước 2 (resolve `?category=<code>` → id, breadcrumb): `GET /categories` */
  async getAll(): Promise<CategoryResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse[]>>(API_ENDPOINTS.CATEGORY.LIST);
    const list = data?.data;
    return Array.isArray(list) ? list : [];
  },

  /** `GET /categories/{id}` — bổ sung meta khi cần trước khi cây bước 2 load xong */
  async getById(id: number | string): Promise<CategoryResponse | null> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse>>(API_ENDPOINTS.CATEGORY.BY_ID(id));
    return data?.data ?? null;
  },

  /** Bước 3 (chip / filter sidebar): `GET /categories/parent/{parentId}/children` */
  async getChildren(parentId: number | string): Promise<CategoryResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<CategoryResponse[]>>(
      API_ENDPOINTS.CATEGORY.CHILDREN(parentId)
    );
    const list = data?.data;
    return Array.isArray(list) ? list : [];
  },

  /**
   * `GET /categories?featured=true&limit=` — danh mục gốc nổi bật cho `/search` không có `q`.
   * Fallback: `GET /categories/roots` (6 mục đầu) — docs/api_search.md §3.
   */
  async getFeaturedSuggested(limit = 6, signal?: AbortSignal): Promise<CategoryResponse[]> {
    const safeLimit = limit >= 1 ? limit : 6;
    try {
      const { data } = await axiosInstance.get<ApiResponse<CategoryResponse[]>>(
        API_ENDPOINTS.CATEGORY.LIST,
        { params: { featured: true, limit: safeLimit }, signal }
      );
      if (data.success === false) {
        throw new Error(typeof data.message === 'string' ? data.message : 'featured categories failed');
      }
      const list = data?.data;
      if (Array.isArray(list) && list.length > 0) return list.slice(0, safeLimit);
    } catch {
      /* fallback roots */
    }
    const roots = await this.getRootCategories(signal);
    return roots.slice(0, safeLimit);
  },
};

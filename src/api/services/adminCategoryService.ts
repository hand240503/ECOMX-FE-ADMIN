import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type {
  CategoryBulkDeleteResponse,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../types/category.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';

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

  /** Xuất toàn bộ danh mục ra Excel (blob, theo cột CSDL). */
  async exportXlsx(signal?: AbortSignal): Promise<Blob> {
    const res = await axiosInstance.get<Blob>(API_ENDPOINTS.ADMIN.CATEGORIES_EXPORT, {
      responseType: 'blob',
      timeout: 120_000,
      signal,
    });
    return res.data;
  },

  /** Xem trước import danh mục (dry-run, không ghi CSDL). */
  async previewXlsx(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postCategoryFile(API_ENDPOINTS.ADMIN.CATEGORIES_IMPORT_PREVIEW, file, 'Xem trước thất bại', signal);
  },

  /** Import/upsert danh mục từ file Excel/CSV/TXT. */
  async importXlsx(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postCategoryFile(API_ENDPOINTS.ADMIN.CATEGORIES_IMPORT, file, 'Nhập danh mục thất bại', signal);
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa danh mục thất bại');
    }
  },

  /**
   * Xóa danh mục hàng loạt. Sản phẩm thuộc danh mục bị xóa được gỡ danh mục (set null),
   * danh mục con được đưa lên gốc (parent set null).
   */
  async bulkRemove(ids: Array<number | string>, signal?: AbortSignal): Promise<CategoryBulkDeleteResponse> {
    const numericIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    const { data } = await axiosInstance.post<ApiResponse<CategoryBulkDeleteResponse>>(
      API_ENDPOINTS.ADMIN.CATEGORIES_BULK_DELETE,
      { ids: numericIds },
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa danh mục hàng loạt thất bại'
      );
    }
    return data.data;
  },
};

async function postCategoryFile(
  url: string,
  file: File,
  fallbackMsg: string,
  signal?: AbortSignal
): Promise<CatalogImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await axiosInstance.post<ApiResponse<CatalogImportResponse>>(url, fd, {
    signal,
    timeout: 120_000,
  });
  if (data.success === false || data.data == null) {
    const errMsg = data.errors?.[0]?.message ?? data.message;
    throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : fallbackMsg);
  }
  return data.data;
}

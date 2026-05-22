import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { PermissionCatalogData } from '../types/adminAccessControl.types';

/** @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md §3.4 — @see docs/ADMIN_PERMISSION_CATALOG_FE.md */
export const adminPermissionCatalogService = {
  async getCatalog(signal?: AbortSignal): Promise<PermissionCatalogData> {
    const { data } = await axiosInstance.get<ApiResponse<PermissionCatalogData>>(
      API_ENDPOINTS.ADMIN.PERMISSIONS_CATALOG,
      { signal }
    );
    if (data.success === false || data.data == null || typeof data.data !== 'object') {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh mục quyền'
      );
    }
    return data.data;
  },
};

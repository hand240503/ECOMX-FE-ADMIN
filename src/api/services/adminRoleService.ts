import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { RoleResponse, UpsertRoleRequest } from '../types/adminAccessControl.types';

/** @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md §1 */
export const adminRoleService = {
  async list(signal?: AbortSignal): Promise<RoleResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<RoleResponse[]>>(API_ENDPOINTS.ADMIN.ROLES, { signal });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách chức vụ'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async create(body: UpsertRoleRequest, signal?: AbortSignal): Promise<RoleResponse> {
    const { data } = await axiosInstance.post<ApiResponse<RoleResponse>>(API_ENDPOINTS.ADMIN.ROLES, body, { signal });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo chức vụ thất bại');
    }
    return data.data;
  },

  async update(id: number | string, body: UpsertRoleRequest, signal?: AbortSignal): Promise<RoleResponse> {
    const { data } = await axiosInstance.put<ApiResponse<RoleResponse>>(API_ENDPOINTS.ADMIN.ROLE_BY_ID(id), body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật chức vụ thất bại');
    }
    return data.data;
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.ROLE_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa chức vụ thất bại');
    }
  },
};

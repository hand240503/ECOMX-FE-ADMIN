import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse, PaginationMetadata } from '../types/common.types';
import type {
  AdminModUserInfoRequest,
  AdminUserResponse,
  AdminUsersListResult,
  CreateAdminUserRequest,
  GrantPermissionRequest,
  RevokePermissionRequest,
  UserPermissionsResponse,
} from '../types/adminAccessControl.types';

function asPaginationMeta(raw: Record<string, unknown> | undefined): PaginationMetadata | null {
  if (!raw) return null;
  const page = Number(raw.page);
  const size = Number(raw.size ?? raw.limit);
  const totalElements = Number(raw.totalElements ?? raw.total);
  const totalPages = Number(raw.totalPages);
  if (!Number.isFinite(page) || !Number.isFinite(size)) return null;
  return {
    page,
    size,
    totalElements: Number.isFinite(totalElements) ? totalElements : 0,
    totalPages: Number.isFinite(totalPages) ? totalPages : 0,
    first: typeof raw.first === 'boolean' ? raw.first : undefined,
    last: typeof raw.last === 'boolean' ? raw.last : undefined,
    hasNext: typeof raw.hasNext === 'boolean' ? raw.hasNext : undefined,
    hasPrevious: typeof raw.hasPrevious === 'boolean' ? raw.hasPrevious : undefined,
    numberOfElements: raw.numberOfElements != null ? Number(raw.numberOfElements) : undefined,
  };
}

/** @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md §2, §3 */
export const adminUserManagementService = {
  async listPaged(page: number, size: number, signal?: AbortSignal): Promise<AdminUsersListResult> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse[]>>(API_ENDPOINTS.ADMIN.USERS, {
      params: { page, size },
      signal,
    });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách người dùng'
      );
    }
    const items = Array.isArray(data.data) ? data.data : [];
    const meta = asPaginationMeta(data.metadata);
    return {
      items,
      page: meta?.page ?? page,
      size: meta?.size ?? size,
      totalElements: meta?.totalElements ?? items.length,
      totalPages: meta?.totalPages ?? (items.length > 0 ? 1 : 0),
    };
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.USER_BY_ID(id), {
      signal,
    });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Không tìm thấy user'
      );
    }
    return data.data;
  },

  async create(body: CreateAdminUserRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.USERS, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo user thất bại');
    }
    return data.data;
  },

  async update(body: AdminModUserInfoRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.put<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.USERS, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật user thất bại');
    }
    return data.data;
  },

  async getUserPermissions(userId: number | string, signal?: AbortSignal): Promise<UserPermissionsResponse> {
    const { data } = await axiosInstance.get<ApiResponse<UserPermissionsResponse>>(
      API_ENDPOINTS.ADMIN.USER_PERMISSIONS(userId),
      { signal }
    );
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được quyền user'
      );
    }
    return data.data;
  },

  async grantPermissions(body: GrantPermissionRequest, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.post<ApiResponse<unknown>>(API_ENDPOINTS.ADMIN.PERMISSIONS_GRANT, body, {
      signal,
    });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cấp quyền thất bại');
    }
  },

  async revokePermissions(body: RevokePermissionRequest, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.post<ApiResponse<unknown>>(API_ENDPOINTS.ADMIN.PERMISSIONS_REVOKE, body, {
      signal,
    });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Thu hồi quyền thất bại');
    }
  },
};

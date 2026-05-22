import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse, PaginationMetadata } from '../types/common.types';
import type {
  AdminUserResponse,
  AdminUsersListResult,
  CreateStaffEmployeeUserRequest,
  StaffEmployeeModUserInfoRequest,
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

function emptyList(page: number, size: number): AdminUsersListResult {
  return {
    items: [],
    page,
    size,
    totalElements: 0,
    totalPages: 1,
  };
}

async function parseList(
  promise: Promise<{ data: ApiResponse<AdminUserResponse[]> }>,
  page: number,
  size: number
): Promise<AdminUsersListResult> {
  try {
    const { data } = await promise;
    if (data.success === false) {
      const emptyish =
        data.data == null || (Array.isArray(data.data) && data.data.length === 0);
      if (emptyish) {
        const meta = asPaginationMeta(data.metadata as Record<string, unknown> | undefined);
        return {
          items: [],
          page: meta?.page ?? page,
          size: meta?.size ?? size,
          totalElements: meta?.totalElements ?? 0,
          totalPages: Math.max(1, meta?.totalPages ?? 1),
        };
      }
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách'
      );
    }
    const items = Array.isArray(data.data) ? data.data : [];
    const meta = asPaginationMeta(data.metadata as Record<string, unknown> | undefined);
    return {
      items,
      page: meta?.page ?? page,
      size: meta?.size ?? size,
      totalElements: meta?.totalElements ?? items.length,
      totalPages: meta?.totalPages ?? (items.length > 0 ? 1 : 1),
    };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return emptyList(page, size);
    }
    throw e;
  }
}

/** @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md — staff (non-CUSTOMER) */
export const adminStaffService = {
  async listPaged(page: number, size: number, signal?: AbortSignal): Promise<AdminUsersListResult> {
    return parseList(
      axiosInstance.get<ApiResponse<AdminUserResponse[]>>(API_ENDPOINTS.ADMIN.STAFF, {
        params: { page, size },
        signal,
      }),
      page,
      size
    );
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.STAFF_BY_ID(id), {
      signal,
    });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Không tìm thấy staff'
      );
    }
    return data.data;
  },

  async create(body: CreateStaffEmployeeUserRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.STAFF, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo staff thất bại');
    }
    return data.data;
  },

  async update(body: StaffEmployeeModUserInfoRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.put<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.STAFF, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật staff thất bại');
    }
    return data.data;
  },

  /** POST — trả `UserResponse` kèm `temporaryPassword` một lần */
  async resetPassword(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(
      API_ENDPOINTS.ADMIN.STAFF_RESET_PASSWORD(id),
      {},
      { signal }
    );
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Đặt lại mật khẩu thất bại'
      );
    }
    return data.data;
  },

  async delete(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<unknown>>(API_ENDPOINTS.ADMIN.STAFF_BY_ID(id), {
      signal,
    });
    if (data != null && typeof data === 'object' && 'success' in data && data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa staff thất bại');
    }
  },
};

/** @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md — role EMPLOYEE only */
export const adminEmployeeService = {
  async listPaged(page: number, size: number, signal?: AbortSignal): Promise<AdminUsersListResult> {
    return parseList(
      axiosInstance.get<ApiResponse<AdminUserResponse[]>>(API_ENDPOINTS.ADMIN.EMPLOYEES, {
        params: { page, size },
        signal,
      }),
      page,
      size
    );
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse>>(
      API_ENDPOINTS.ADMIN.EMPLOYEE_BY_ID(id),
      { signal }
    );
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tìm thấy nhân viên (EMPLOYEE)'
      );
    }
    return data.data;
  },

  async create(body: CreateStaffEmployeeUserRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.EMPLOYEES, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo nhân viên thất bại');
    }
    return data.data;
  },

  async update(body: StaffEmployeeModUserInfoRequest, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.put<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.EMPLOYEES, body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật nhân viên thất bại'
      );
    }
    return data.data;
  },
};

/** @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md — chỉ CUSTOMER, đọc */
export const adminCustomerService = {
  async listPaged(page: number, size: number, signal?: AbortSignal): Promise<AdminUsersListResult> {
    return parseList(
      axiosInstance.get<ApiResponse<AdminUserResponse[]>>(API_ENDPOINTS.ADMIN.CUSTOMERS, {
        params: { page, size },
        signal,
      }),
      page,
      size
    );
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse>>(API_ENDPOINTS.ADMIN.CUSTOMER_BY_ID(id), {
      signal,
    });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tìm thấy khách hàng'
      );
    }
    return data.data;
  },
};

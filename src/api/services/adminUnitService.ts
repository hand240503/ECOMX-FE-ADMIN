import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CreateUnitRequest, UnitResponse, UpdateUnitRequest } from '../types/unit.types';

/**
 * Admin units CRUD — `/{api.prefix}/admin/units`.
 * Quyền catalogue chuẩn: 100xxx; legacy: 160xxx. @see docs/ADMIN_PERMISSION_CATALOG_FE.md
 * @see docs/ADMIN_UNITS.md
 */
export const adminUnitService = {
  async list(signal?: AbortSignal): Promise<UnitResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<UnitResponse[]>>(API_ENDPOINTS.ADMIN.UNITS, { signal });
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Không tải được danh sách đơn vị'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<UnitResponse> {
    const { data } = await axiosInstance.get<ApiResponse<UnitResponse>>(API_ENDPOINTS.ADMIN.UNIT_BY_ID(id), { signal });
    if (data.success === false || data.data == null) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Không tìm thấy đơn vị'
      );
    }
    return data.data;
  },

  async create(body: CreateUnitRequest, signal?: AbortSignal): Promise<UnitResponse> {
    const { data } = await axiosInstance.post<ApiResponse<UnitResponse>>(API_ENDPOINTS.ADMIN.UNITS, body, { signal });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Tạo đơn vị thất bại');
    }
    return data.data;
  },

  async update(id: number | string, body: UpdateUnitRequest, signal?: AbortSignal): Promise<UnitResponse> {
    const { data } = await axiosInstance.put<ApiResponse<UnitResponse>>(API_ENDPOINTS.ADMIN.UNIT_BY_ID(id), body, {
      signal,
    });
    if (data.success === false || data.data == null) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Cập nhật đơn vị thất bại'
      );
    }
    return data.data;
  },

  async remove(id: number | string, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(API_ENDPOINTS.ADMIN.UNIT_BY_ID(id), { signal });
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa đơn vị thất bại');
    }
  },
};

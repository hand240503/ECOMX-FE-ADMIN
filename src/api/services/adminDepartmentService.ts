import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CreateDepartmentBody, DepartmentDto } from '../types/department.types';
import { getApiErrorMessage } from '../../utils/apiError';

export const adminDepartmentService = {
  async list(): Promise<DepartmentDto[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<DepartmentDto[]>>(
        API_ENDPOINTS.ADMIN.DEPARTMENTS
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi tải phòng ban');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Không tải được danh sách phòng ban'));
    }
  },

  async getById(id: number | string): Promise<DepartmentDto> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<DepartmentDto>>(
        API_ENDPOINTS.ADMIN.DEPARTMENT_BY_ID(id)
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Không tải được phòng ban'));
    }
  },

  async create(body: CreateDepartmentBody): Promise<DepartmentDto> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<DepartmentDto>>(
        API_ENDPOINTS.ADMIN.DEPARTMENTS, body
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Tạo phòng ban thất bại'));
    }
  },

  async update(id: number | string, body: CreateDepartmentBody): Promise<DepartmentDto> {
    try {
      const { data } = await axiosInstance.put<ApiResponse<DepartmentDto>>(
        API_ENDPOINTS.ADMIN.DEPARTMENT_BY_ID(id), body
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Cập nhật phòng ban thất bại'));
    }
  },

  async delete(id: number | string): Promise<void> {
    try {
      await axiosInstance.delete(API_ENDPOINTS.ADMIN.DEPARTMENT_BY_ID(id));
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Xoá phòng ban thất bại'));
    }
  },

  async getMyDepartments(): Promise<DepartmentDto[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<DepartmentDto[]>>(
        `${API_ENDPOINTS.ADMIN.DEPARTMENTS}/my`
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Không tải được phòng ban của bạn'));
    }
  },

  async addMember(
    deptId: number | string,
    userId: number | string,
    position: 'LEADER' | 'MEMBER' = 'MEMBER',
  ): Promise<DepartmentDto> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<DepartmentDto>>(
        API_ENDPOINTS.ADMIN.DEPARTMENT_ADD_MEMBER(deptId, userId),
        { position },
      );
      if (!data.success || data.data === undefined) throw new Error(data.message || 'Lỗi');
      return data.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Thêm thành viên thất bại'));
    }
  },

  async removeMember(deptId: number | string, userId: number | string): Promise<void> {
    try {
      await axiosInstance.delete(
        API_ENDPOINTS.ADMIN.DEPARTMENT_REMOVE_MEMBER(deptId, userId)
      );
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Xoá thành viên thất bại'));
    }
  },
};

import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { CreateAddressRequest, UpdateAddressRequest, UserAddress } from '../types/auth.types';
import type { ApiResponse } from '../types/common.types';

const parseApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiResponse<unknown> | undefined;
    const fieldMsg = body?.errors?.find((e) => e.message)?.message;
    if (fieldMsg) return fieldMsg;
    if (body?.message) return body.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const addressService = {
  /**
   * `GET /users/addresses` — `APIResponse<UserAddress[]>`
   * @see docs/API_user_address.md
   */
  async list(): Promise<UserAddress[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<UserAddress[]>>(API_ENDPOINTS.USER.ADDRESSES);

      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được danh sách địa chỉ');
      }

      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được danh sách địa chỉ'));
    }
  },

  /**
   * `POST /users/addresses` — `201`, `CreateAddressRequest`
   * @see docs/API_user_address.md
   */
  async create(payload: CreateAddressRequest): Promise<UserAddress> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<UserAddress>>(API_ENDPOINTS.USER.ADDRESSES, payload);

      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không thêm được địa chỉ');
      }

      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không thêm được địa chỉ'));
    }
  },

  /**
   * `GET /users/addresses/{id}`
   * @see docs/API_user_address.md
   */
  async getById(id: number | string): Promise<UserAddress> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<UserAddress>>(API_ENDPOINTS.USER.ADDRESS_BY_ID(id));

      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được địa chỉ');
      }

      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được địa chỉ'));
    }
  },

  /**
   * `PUT /users/addresses/{id}` — `UpdateAddressRequest`
   * @see docs/API_user_address.md
   */
  async update(id: number | string, payload: UpdateAddressRequest): Promise<UserAddress> {
    try {
      const { data } = await axiosInstance.put<ApiResponse<UserAddress>>(
        API_ENDPOINTS.USER.ADDRESS_BY_ID(id),
        payload
      );

      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không cập nhật được địa chỉ');
      }

      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không cập nhật được địa chỉ'));
    }
  }
};

import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { OrderDto } from '../types/order.types';

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

export const adminOrderService = {
  /**
   * GET /admin/orders?status={status}
   * Yêu cầu quyền READ_ORDER (500002).
   */
  async listOrders(status?: number): Promise<OrderDto[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<OrderDto[]>>(
        API_ENDPOINTS.ADMIN.ORDERS,
        { params: status != null ? { status } : undefined }
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được danh sách đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được danh sách đơn hàng'));
    }
  },

  /**
   * GET /admin/orders/{id}
   * Yêu cầu quyền READ_ORDER (500002).
   */
  async getOrderById(id: number): Promise<OrderDto> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<OrderDto>>(
        API_ENDPOINTS.ADMIN.ORDER_BY_ID(id)
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được đơn hàng'));
    }
  },

  /**
   * PATCH /admin/orders/{id}/status
   * Yêu cầu quyền UPDATE_ORDER (500003).
   * Luồng hợp lệ: 1→2/5, 2→3/5, 3→4/5. Trạng thái 4 và 5 là terminal.
   */
  async updateOrderStatus(id: number, status: number): Promise<OrderDto> {
    try {
      const { data } = await axiosInstance.patch<ApiResponse<OrderDto>>(
        API_ENDPOINTS.ADMIN.ORDER_UPDATE_STATUS(id),
        { status }
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không cập nhật được trạng thái đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không cập nhật được trạng thái đơn hàng'));
    }
  },
};

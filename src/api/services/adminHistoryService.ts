import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse, PaginationMetadata } from '../types/common.types';
import type {
  UnifiedHistoryResponse,
  HistorySearchParams,
  PriceEventHistoryResponse,
  PriceEventSearchParams,
} from '../types/history.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Paginated response types ─────────────────────────────────────────────────

export interface PagedHistoryResult {
  items: UnifiedHistoryResponse[];
  pagination: PaginationMetadata | null;
}

export interface PagedPriceEventResult {
  items: PriceEventHistoryResponse[];
  pagination: PaginationMetadata | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const adminHistoryService = {
  /**
   * GET /admin/history
   * Tìm kiếm lịch sử thống nhất từ cả order_history + admin_activity_log.
   */
  async search(params: HistorySearchParams = {}): Promise<PagedHistoryResult> {
    try {
      const query: Record<string, string | number> = {};
      if (params.source)        query.source        = params.source;
      if (params.entityType)    query.entityType    = params.entityType;
      if (params.entityId)      query.entityId      = params.entityId;
      if (params.actorUserId)   query.actorUserId   = params.actorUserId;
      if (params.actorRoleCode) query.actorRoleCode = params.actorRoleCode;
      if (params.action)        query.action        = params.action;
      if (params.from)          query.from          = params.from;
      if (params.to)            query.to            = params.to;
      if (params.page  != null) query.page          = params.page;
      if (params.size  != null) query.size          = params.size;

      const { data } = await axiosInstance.get<ApiResponse<UnifiedHistoryResponse[]>>(
        API_ENDPOINTS.ADMIN.HISTORY,
        { params: query }
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được lịch sử');
      }
      return {
        items: data.data,
        pagination: (data as any).pagination ?? null,
      };
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được lịch sử'));
    }
  },

  /**
   * GET /admin/history/orders/{orderId}
   * Toàn bộ lịch sử của một đơn hàng.
   */
  async getOrderHistory(orderId: number): Promise<UnifiedHistoryResponse[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<UnifiedHistoryResponse[]>>(
        API_ENDPOINTS.ADMIN.HISTORY_ORDER(orderId)
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được lịch sử đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được lịch sử đơn hàng'));
    }
  },

  /**
   * GET /admin/history/price-events
   * Tìm kiếm lịch sử sự kiện chương trình giá.
   */
  async searchPriceEvents(params: PriceEventSearchParams = {}): Promise<PagedPriceEventResult> {
    try {
      const query: Record<string, string | number> = {};
      if (params.programType) query.programType = params.programType;
      if (params.programId)   query.programId   = params.programId;
      if (params.eventType)   query.eventType   = params.eventType;
      if (params.productId)   query.productId   = params.productId;
      if (params.from)        query.from        = params.from;
      if (params.to)          query.to          = params.to;
      if (params.page != null) query.page       = params.page;
      if (params.size != null) query.size       = params.size;

      const { data } = await axiosInstance.get<ApiResponse<PriceEventHistoryResponse[]>>(
        API_ENDPOINTS.ADMIN.HISTORY_PRICE_EVENTS,
        { params: query }
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được lịch sử giá');
      }
      return {
        items: data.data,
        pagination: (data as any).pagination ?? null,
      };
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được lịch sử giá'));
    }
  },
};

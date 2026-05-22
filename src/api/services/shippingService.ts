import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { ShippingDistanceResponse } from '../types/shipping.types';

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

function readNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readIntNullable(v: unknown): number | null {
  if (v == null) return null;
  const n = readNum(v);
  return n != null ? Math.round(n) : null;
}

function normalizeShippingData(raw: Record<string, unknown>): ShippingDistanceResponse {
  return {
    distanceMeters: readNum(raw.distanceMeters ?? raw.distance_meters) ?? 0,
    distanceKilometers: readNum(raw.distanceKilometers ?? raw.distance_kilometers) ?? 0,
    durationSeconds: readNum(raw.durationSeconds ?? raw.duration_seconds) ?? 0,
    resolvedAddress:
      typeof raw.resolvedAddress === 'string'
        ? raw.resolvedAddress
        : typeof raw.resolved_address === 'string'
          ? raw.resolved_address
          : null,
    originLatitude: readNum(raw.originLatitude ?? raw.origin_latitude) ?? 0,
    originLongitude: readNum(raw.originLongitude ?? raw.origin_longitude) ?? 0,
    warehouseLatitude: readNum(raw.warehouseLatitude ?? raw.warehouse_latitude) ?? 0,
    warehouseLongitude: readNum(raw.warehouseLongitude ?? raw.warehouse_longitude) ?? 0,
    shippingFeeVnd: readIntNullable(raw.shippingFeeVnd ?? raw.shipping_fee_vnd),
  };
}

export const shippingService = {
  /**
   * `GET /shipping/distance-to-warehouse?address=...`
   * @param address — tối đa 500 ký tự (cắt trên client).
   */
  async getDistanceToWarehouse(
    address: string,
    options?: { signal?: AbortSignal }
  ): Promise<ShippingDistanceResponse> {
    const trimmed = address.trim().slice(0, 500);
    if (!trimmed) {
      throw new Error('Thiếu địa chỉ để ước tính phí ship');
    }
    try {
      const { data } = await axiosInstance.get<ApiResponse<Record<string, unknown>>>(
        API_ENDPOINTS.SHIPPING.DISTANCE_TO_WAREHOUSE,
        { params: { address: trimmed }, signal: options?.signal }
      );
      if (!data.success || data.data == null || typeof data.data !== 'object') {
        throw new Error(data.message || 'Không ước tính được phí vận chuyển');
      }
      return normalizeShippingData(data.data);
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không ước tính được phí vận chuyển'));
    }
  },
};

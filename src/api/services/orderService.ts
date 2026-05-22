import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type {
  CreatedOrder,
  CreateOrderRequestBody,
  CreateOrderResult,
  OrderDto,
  OrderShippingSnapshot,
  PaymentMethodDto,
  VnpayPaymentUrlData,
  VnpayPendingDto,
  VnpayTransactionStatusDto,
} from '../types/order.types';

function asPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function readOutcome(d: Record<string, unknown>): string | undefined {
  const o = d.outcome;
  if (typeof o === 'string' && o.trim() !== '') return o.trim();
  return undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

/** `transactionPublicId` từ BE có thể là chuỗi hoặc số (ví dụ 42 / "42") — không dùng UUID do FE tạo. */
function readTransactionPublicIdFromPayload(d: Record<string, unknown>): string | undefined {
  const raw = d.transactionPublicId ?? d.transaction_public_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const s = String(Math.trunc(raw));
    return s !== '' ? s : undefined;
  }
  return readNonEmptyString(raw);
}

function readPendingTotalFromPayload(d: Record<string, unknown>): number | undefined {
  const raw = d.pendingTotal ?? d.pending_total;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function hasOrderCreatedShape(d: Record<string, unknown>): boolean {
  const id = asPositiveInt(d.id ?? d.orderId);
  const orderCode = d.orderCode ?? d.order_code;
  return id != null && typeof orderCode === 'string';
}

function readShippingSnapshot(d: Record<string, unknown>): OrderShippingSnapshot {
  const out: OrderShippingSnapshot = {};
  if (d.shippingFeeVnd !== undefined || d.shipping_fee_vnd !== undefined) {
    const v = d.shippingFeeVnd !== undefined ? d.shippingFeeVnd : d.shipping_fee_vnd;
    if (v === null) out.shippingFeeVnd = null;
    else if (typeof v === 'number' && Number.isFinite(v)) out.shippingFeeVnd = Math.round(v);
  }
  if (d.deliveryDistanceMeters !== undefined || d.delivery_distance_meters !== undefined) {
    const v =
      d.deliveryDistanceMeters !== undefined ? d.deliveryDistanceMeters : d.delivery_distance_meters;
    if (v === null) out.deliveryDistanceMeters = null;
    else if (typeof v === 'number' && Number.isFinite(v)) out.deliveryDistanceMeters = Math.round(v);
  }
  return out;
}

/** Chuẩn hóa `data` từ `POST /orders` (hợp đồng mới + snake_case + tương thích đơn phẳng). */
function normalizeCreateOrderResult(raw: unknown): CreateOrderResult {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid create order response');
  }
  const d = raw as Record<string, unknown>;
  const outcome = readOutcome(d);

  if (outcome === 'ORDER_CREATED') {
    const orderPayload = d.order;
    if (orderPayload != null && typeof orderPayload === 'object') {
      return {
        outcome: 'ORDER_CREATED',
        order: orderPayload as CreatedOrder,
        ...readShippingSnapshot(d),
      };
    }
  }

  if (outcome === 'PENDING_VNPAY_PAYMENT') {
    const checkoutSessionId = asPositiveInt(
      d.checkoutSessionId ?? d.checkout_session_id
    );
    const transactionPublicId = readTransactionPublicIdFromPayload(d);
    if (checkoutSessionId != null && transactionPublicId) {
      const pmRaw = d.paymentMethod ?? d.payment_method;
      const paymentMethod =
        pmRaw != null && typeof pmRaw === 'object'
          ? (pmRaw as { id: number; name: string; code: string })
          : undefined;
      const pendingTotal = readPendingTotalFromPayload(d);
      return {
        outcome: 'PENDING_VNPAY_PAYMENT',
        checkoutSessionId,
        transactionPublicId,
        pendingTotal,
        paymentMethod,
        message: readNonEmptyString(d.message),
        ...readShippingSnapshot(d),
      };
    }
  }

  if (hasOrderCreatedShape(d)) {
    return {
      outcome: 'ORDER_CREATED',
      order: raw as CreatedOrder,
      ...readShippingSnapshot(d),
    };
  }

  throw new Error('Unknown create order response shape');
}

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

export const orderService = {
  async listPaymentMethods(): Promise<PaymentMethodDto[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<PaymentMethodDto[]>>(
        API_ENDPOINTS.ORDER.PAYMENT_METHODS
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được phương thức thanh toán');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được phương thức thanh toán'));
    }
  },

  /**
   * `GET /orders` — `status` 1..5 theo tài liệu; bỏ qua = tất cả.
   * @see docs/API_add_order.md
   */
  async listOrders(status?: number): Promise<OrderDto[]> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<OrderDto[]>>(API_ENDPOINTS.ORDER.LIST, {
        params: status != null ? { status } : undefined,
      });
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được danh sách đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được danh sách đơn hàng'));
    }
  },

  async getOrderById(id: number): Promise<OrderDto> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<OrderDto>>(API_ENDPOINTS.ORDER.BY_ID(id));
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được đơn hàng'));
    }
  },

  /**
   * Hủy đơn (chỉ khi đơn ở trạng thái cho phép — thường `status === 1`).
   * `POST /orders/{id}/cancel`
   * @see docs/API_add_order.md
   */
  async cancelOrder(id: number): Promise<OrderDto> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<OrderDto>>(API_ENDPOINTS.ORDER.CANCEL(id), {});
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không hủy được đơn hàng');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không hủy được đơn hàng'));
    }
  },

  async submitReturnRequest(id: number, body?: { reason?: string }): Promise<void> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<unknown>>(
        API_ENDPOINTS.ORDER.RETURN_REQUEST(id),
        body ?? {}
      );
      if (!data.success) {
        throw new Error(data.message || 'Không gửi được yêu cầu trả hàng');
      }
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không gửi được yêu cầu trả hàng'));
    }
  },

  async createOrder(body: CreateOrderRequestBody): Promise<CreateOrderResult> {
    try {
      const { data, status } = await axiosInstance.post<ApiResponse<unknown>>(API_ENDPOINTS.ORDER.CREATE, body);
      if ((status === 201 || data.success) && data.data !== undefined) {
        return normalizeCreateOrderResult(data.data);
      }
      throw new Error(data.message || 'create_order_error');
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tạo được đơn hàng'));
    }
  },

  /** `POST /payment/vnpay/checkout-sessions/{sessionId}/payment-url` */
  async createVnpayPaymentUrl(checkoutSessionId: number): Promise<VnpayPaymentUrlData> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<Record<string, unknown>>>(
        API_ENDPOINTS.VNPAY.CHECKOUT_SESSION_PAYMENT_URL(checkoutSessionId),
        {}
      );
      if (!data.success || data.data == null || typeof data.data !== 'object') {
        throw new Error(data.message || 'Không tạo được liên kết VNPAY');
      }
      const d = data.data;
      const paymentUrl = readNonEmptyString(d.paymentUrl ?? d.payment_url);
      if (!paymentUrl) {
        throw new Error(data.message || 'Thiếu paymentUrl từ máy chủ');
      }
      return {
        paymentUrl,
        txnRef: readNonEmptyString(d.txnRef ?? d.txn_ref),
        vnpAmount: typeof d.vnpAmount === 'number' ? d.vnpAmount : typeof d.vnp_amount === 'number' ? d.vnp_amount : undefined,
      };
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tạo được liên kết VNPAY'));
    }
  },

  /** `GET /orders/vnpay-pending/{transactionPublicId}/transaction-status` — JWT. */
  async getVnpayTransactionStatus(transactionPublicId: string): Promise<VnpayTransactionStatusDto | null> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<VnpayTransactionStatusDto>>(
        API_ENDPOINTS.ORDER.VNPAY_PENDING_TRANSACTION_STATUS(transactionPublicId)
      );
      if (!data.success || data.data === undefined) return null;
      return data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      return null;
    }
  },

  /** `GET /orders/vnpay-pending/{transactionPublicId}` */
  async getVnpayPending(transactionPublicId: string): Promise<VnpayPendingDto> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<VnpayPendingDto>>(
        API_ENDPOINTS.ORDER.VNPAY_PENDING(transactionPublicId)
      );
      if (!data.success || data.data === undefined) {
        throw new Error(data.message || 'Không tải được trạng thái phiên thanh toán');
      }
      return data.data;
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không tải được trạng thái phiên thanh toán'));
    }
  },

  /**
   * `POST /orders/vnpay-pending/{transactionPublicId}/abandon` — không body.
   * Thành công: `data` có thể `null`. Idempotent khi đã CANCELLED.
   */
  async abandonVnpayPending(transactionPublicId: string): Promise<void> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<null>>(
        API_ENDPOINTS.ORDER.VNPAY_ABANDON(transactionPublicId)
      );
      if (!data.success) {
        throw new Error(data.message || 'Không hủy được phiên thanh toán');
      }
    } catch (error) {
      throw new Error(parseApiErrorMessage(error, 'Không hủy được phiên thanh toán'));
    }
  },

  /**
   * **DEV / staging cần tường minh:** mô phỏng IPN thành công khi VNPAY không gọi được IPN tới `localhost` — JWT, không body.
   * Cần BE bật `vnpay.dev-simulate-success-enabled`. Idempotent nếu phiên đã `COMPLETED` (tài liệu: trả lại cùng đơn). `null` nếu 403/400/404 hoặc tắt tính năng.
   * @see docs/VNPAY_CHECKOUT_SESSIONS_FE_GUIDE.md §4
   */
  async devSimulateVnpaySuccess(transactionPublicId: string): Promise<CreatedOrder | null> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<Record<string, unknown>>>(
        API_ENDPOINTS.ORDER.VNPAY_DEV_SIMULATE_SUCCESS(transactionPublicId),
        {}
      );
      if (!data.success || data.data == null || typeof data.data !== 'object') return null;
      const d = data.data as Record<string, unknown>;
      if (hasOrderCreatedShape(d)) return d as CreatedOrder;
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const s = error.response?.status;
        if (s === 403 || s === 400 || s === 404) return null;
      }
      return null;
    }
  },
};

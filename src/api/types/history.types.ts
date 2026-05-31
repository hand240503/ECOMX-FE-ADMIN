/**
 * Types cho History API — /admin/history
 * Đồng bộ với UnifiedHistoryResponse.java
 */

// ─── Enums / constants ────────────────────────────────────────────────────────

/** Nguồn dữ liệu lịch sử */
export type HistorySource = 'ORDER_HISTORY' | 'ACTIVITY_LOG';

/** Loại entity được tác động */
export type HistoryEntityType =
  | 'ORDER'
  | 'PRODUCT'
  | 'BRAND'
  | 'CATEGORY'
  | 'PRICE_CHANGE'
  | 'VOLUME_TIER'
  | 'PWP_OFFER';

/** Hành động */
export type HistoryAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ORDER_STATUS'
  | 'RETURN_REFUND_STATUS';

/** Role người thực hiện */
export type HistoryActorRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';

// ─── Response DTO ─────────────────────────────────────────────────────────────

export interface UnifiedHistoryResponse {
  /** ORDER_HISTORY | ACTIVITY_LOG */
  source: HistorySource;

  id: number;
  createdAt: string; // ISO-8601

  // Actor
  actorUserId?: number;
  actorUsername?: string;
  actorFullName?: string;
  /** Chỉ có ở ACTIVITY_LOG */
  ipAddress?: string;

  // Action
  action: HistoryAction;

  // Entity
  entityType: HistoryEntityType;
  entityId?: number;
  entityLabel?: string;

  // Chi tiết ACTIVITY_LOG
  snapshotBefore?: string; // JSON
  snapshotAfter?: string;  // JSON

  // Chi tiết ORDER_HISTORY
  oldStatus?: number;
  newStatus?: number;
  oldStatusLabel?: string;
  newStatusLabel?: string;

  oldReturnRefundStatus?: number;
  newReturnRefundStatus?: number;
  oldReturnRefundStatusLabel?: string;
  newReturnRefundStatusLabel?: string;

  note?: string;
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface HistorySearchParams {
  source?: string;       // 'ALL' | 'ORDER_HISTORY' | 'ACTIVITY_LOG'
  entityType?: string;
  entityId?: number;
  actorUserId?: number;
  actorRoleCode?: string;
  action?: string;
  from?: string;         // ISO-8601
  to?: string;
  page?: number;
  size?: number;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const ENTITY_TYPE_LABELS: Record<HistoryEntityType, string> = {
  ORDER: 'Đơn hàng',
  PRODUCT: 'Sản phẩm',
  BRAND: 'Thương hiệu',
  CATEGORY: 'Danh mục',
  PRICE_CHANGE: 'Giá theo TG',
  VOLUME_TIER: 'Giá theo bậc',
  PWP_OFFER: 'Mua kèm (PwP)',
};

export const ACTION_LABELS: Record<HistoryAction, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  ORDER_STATUS: 'Đổi trạng thái ĐH',
  RETURN_REFUND_STATUS: 'Hoàn / Trả hàng',
};

export const ACTOR_ROLE_LABELS: Record<HistoryActorRole, string> = {
  EMPLOYEE: 'Nhân viên',
  MANAGER: 'Quản lý',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

// ─── Price Event History ──────────────────────────────────────────────────────

/** Loại chương trình giá */
export type PriceEventProgramType = 'PRICE_CHANGE' | 'VOLUME_TIER' | 'PWP_OFFER';

/** Loại sự kiện giá */
export type PriceEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'ENABLED'
  | 'DISABLED'
  | 'STARTED'
  | 'ENDED'
  | 'EXPIRED';

/** DTO từ GET /admin/history/price-events — đồng bộ PriceEventHistoryResponse.java */
export interface PriceEventHistoryResponse {
  id: number;
  createdAt: string; // ISO-8601

  programType: PriceEventProgramType;
  programTypeLabel?: string;
  programId: number;

  eventType: PriceEventType;
  eventTypeLabel?: string;

  productId?: number;
  productVariantId?: number;

  oldBasePrice?: number;
  newBasePrice?: number;
  oldSalePrice?: number;
  newSalePrice?: number;

  oldQuantityLimit?: number;
  newQuantityLimit?: number;

  programStartAt?: string;
  programEndAt?: string;

  actorUserId?: number;
  actorUsername?: string;
  actorFullName?: string;

  note?: string;
}

/** Query params cho /admin/history/price-events */
export interface PriceEventSearchParams {
  programType?: string;
  programId?: number;
  eventType?: string;
  productId?: number;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

// ─── Price event UI helpers ───────────────────────────────────────────────────

export const PROGRAM_TYPE_LABELS: Record<PriceEventProgramType, string> = {
  PRICE_CHANGE: 'Giá theo thời gian',
  VOLUME_TIER:  'Giá theo bậc SL',
  PWP_OFFER:    'Mua kèm (PwP)',
};

export const PRICE_EVENT_TYPE_LABELS: Record<PriceEventType, string> = {
  CREATED:  'Tạo mới',
  UPDATED:  'Cập nhật',
  DELETED:  'Xóa',
  ENABLED:  'Bật',
  DISABLED: 'Tắt',
  STARTED:  'Bắt đầu (auto)',
  ENDED:    'Kết thúc (auto)',
  EXPIRED:  'Hết quota',
};

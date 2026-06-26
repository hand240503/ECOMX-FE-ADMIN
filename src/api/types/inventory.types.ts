/**
 * Quản lý kho hàng (admin) — tồn kho ở cấp biến thể (ProductVariant / SKU).
 * @see AdminInventoryController, docs/QUAN_LY_KHO_HANG.md
 */

export type InventoryStockResponse = {
  storeId?: number | null;
  storeName?: string | null;
  variantId: number;
  skuCode?: string | null;
  productId?: number | null;
  productName?: string | null;
  optionValues?: Record<string, string> | null;
  onHand: number;
  reserved: number;
  available: number;
};

export type InventoryMovementType =
  | 'IMPORT'
  | 'ADJUST'
  | 'RESERVE'
  | 'RELEASE'
  | 'SALE_OUT'
  | 'RETURN_IN'
  | 'RETURN_SCRAP'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN';

export type InventoryLedgerResponse = {
  id: number;
  variantId?: number | null;
  storeId?: number | null;
  storeName?: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  sumBegin?: number | null;
  sumEnd?: number | null;
  orderDetailId?: number | null;
  note?: string | null;
  createdDate?: string | null;
};

/** `POST /admin/inventory/import` */
export type InventoryImportRequest = {
  storeId: number;
  variantId: number;
  quantity: number;
  note?: string;
};

/** `POST /admin/inventory/adjust` */
export type InventoryAdjustRequest = {
  storeId: number;
  variantId: number;
  onHand: number;
  note?: string;
};

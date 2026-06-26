/**
 * Kho / cửa hàng (store) — quản lý đa kho.
 * @see AdminStoreController, StoreController
 */

export type StoreResponse = {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
  isDefault: boolean;
  note?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

/** `POST /admin/stores` */
export type StoreCreateRequest = {
  code: string;
  name: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  active?: boolean;
  isDefault?: boolean;
  note?: string;
};

/** `PUT /admin/stores/{id}` — tất cả tùy chọn. */
export type StoreUpdateRequest = Partial<StoreCreateRequest>;

/** `POST /admin/stores/transfer` */
export type StockTransferRequest = {
  fromStoreId: number;
  toStoreId: number;
  items: Array<{ variantId: number; quantity: number }>;
  note?: string;
};

/** `GET /shipping/stores?address=` — store + phí ship tới địa chỉ. */
export type ShippingStoreOptionResponse = {
  storeId: number;
  code: string;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  routable: boolean;
  distanceMeters?: number | null;
  distanceKilometers?: number | null;
  durationSeconds?: number | null;
  shippingFeeVnd?: number | null;
};

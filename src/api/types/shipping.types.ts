/** @see docs/API_SHIPPING_AND_ORDERS_UPDATE.md */

export type ShippingDistanceResponse = {
  distanceMeters: number;
  distanceKilometers: number;
  durationSeconds: number;
  resolvedAddress: string | null;
  originLatitude: number;
  originLongitude: number;
  warehouseLatitude: number;
  warehouseLongitude: number;
  /** Phí ship (VND) — có thể `null` nếu BE không tính được. */
  shippingFeeVnd: number | null;
};

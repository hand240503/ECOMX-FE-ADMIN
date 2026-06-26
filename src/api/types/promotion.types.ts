export type PurchaseWithPurchaseOffer = {
  id: number;
  anchorProductId: number;
  /** Phân loại neo — `product_variant.id`. BE bắt buộc khi tạo/sửa (@see ADMIN_PURCHASE_WITH_PURCHASE.md). */
  anchorVariantId?: number;
  companionProductId: number;
  companionVariantId?: number;
  promoUnitPrice: number;
  minAnchorQuantity: number;
  companionPromoUnitsPerAnchor: number;
  maxCompanionPromoUnits: number | null;
  enabled: boolean;
  /** Khung thời gian áp dụng (ISO 8601). null/absent = không giới hạn. Chọn khi import. */
  startAt?: string | null;
  endAt?: string | null;
};

export type PurchaseWithPurchaseOfferUpsert = Omit<PurchaseWithPurchaseOffer, 'id'>;


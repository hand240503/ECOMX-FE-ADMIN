import type { PaymentMethodDto } from './order.types';

export type CheckoutPricingPreviewRequest = {
  lines: Array<{
    productId: number;
    productVariantId: number;
    quantity: number;
    description?: string;
  }>;
};

export type PriceChangeProgramSnapshot = {
  id?: number;
  productVariantId?: number;
  basePrice?: number;
  salePrice?: number | null;
  resolvedUnitPrice?: number;
  startAtEpochMs?: number;
  endAtEpochMs?: number | null;
  quantityLimit?: number | null;
  soldQuantity?: number;
  requiredPaymentMethodCode?: string | null;
};

export type VolumeTierProgramSnapshot = {
  id?: number;
  minQuantity?: number;
  tierUnitPrice?: number;
  aggregateQuantityForVariantOnOrder?: number;
};

export type PwpProgramSnapshot = {
  offerId?: number;
  anchorProductId?: number;
  companionProductId?: number;
  anchorVariantId?: number;
  companionVariantId?: number;
  promoUnitPrice?: number;
  promoQuantity?: number;
  regularQuantity?: number;
  regularUnitPriceAfterPrograms?: number;
};

export type LineItemPricingPrograms = {
  pricedAtEpochMs?: number;
  catalogUnitPrice?: number;
  effectiveUnitBeforeVolumeTier?: number;
  finalUnitPrice?: number;
  lineTotal?: number;
  price_change?: PriceChangeProgramSnapshot | null;
  volume_tier?: VolumeTierProgramSnapshot | null;
  purchase_with_purchase?: PwpProgramSnapshot | null;
};

export type CheckoutPricingLineItem = {
  product_id: number;
  product_variant_id: number;
  product_name: string;
  variant_sku_code?: string | null;
  variant_options?: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  pricing_programs?: LineItemPricingPrograms | null;
};

export type PwpSuggestion = {
  offer_id: number;
  anchor_product_id: number;
  anchor_variant_id?: number | null;
  companion_product_id: number;
  companion_variant_id: number;
  companion_product_name: string;
  companion_variant_sku_code?: string | null;
  companion_variant_options?: Record<string, string> | null;
  companion_thumbnail_url?: string | null;
  promo_unit_price: number;
  companion_regular_price: number;
  min_anchor_quantity: number;
  companion_promo_units_per_anchor: number;
  max_companion_promo_units?: number | null;
};

export type CheckoutPricingPreview = {
  lines: CheckoutPricingLineItem[];
  items_subtotal: number;
  pwp_suggestions: PwpSuggestion[];
};

export type PaymentMethodWithPcBenefit = PaymentMethodDto & {
  hasPcDiscount?: boolean;
  pcDiscountLabel?: string;
};

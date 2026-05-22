import type {
  CreatedOrderDetail,
  OrderDto,
  OrderLinePriceChangePrograms,
  OrderLinePricingPrograms,
  OrderLinePwpPrograms,
  OrderLineVolumeTierPrograms,
} from '../api/types/order.types';

function readInt(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return undefined;
}

function readFinite(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
}

function coercePriceChange(raw: unknown): OrderLinePriceChangePrograms | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = readInt(o.id);
  const resolved = readFinite(o.resolvedUnitPrice, o.resolved_unit_price);
  const base = readFinite(o.basePrice, o.base_price);
  const sale = readFinite(o.salePrice, o.sale_price);
  const start = readFinite(o.startEpochMs, o.start_epoch_ms);
  const end = readFinite(o.endEpochMs, o.end_epoch_ms);
  if (
    id == null &&
    resolved == null &&
    base == null &&
    sale == null &&
    start == null &&
    end == null
  ) {
    return null;
  }
  return {
    ...(id != null ? { id } : {}),
    ...(resolved != null ? { resolvedUnitPrice: resolved } : {}),
    ...(base != null ? { basePrice: base } : {}),
    ...(sale != null ? { salePrice: sale } : {}),
    ...(start != null ? { startEpochMs: start } : {}),
    ...(end != null ? { endEpochMs: end } : {}),
  };
}

function coerceVolumeTier(raw: unknown): OrderLineVolumeTierPrograms | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const minQ = readInt(o.minQuantity, o.min_quantity);
  const tierP = readFinite(o.tierUnitPrice, o.tier_unit_price);
  const aggVariant = readInt(
    o.aggregateQuantityForVariantOnOrder,
    o.aggregate_quantity_for_variant_on_order
  );
  const aggProduct = readInt(
    o.aggregateQuantityForProductOnOrder,
    o.aggregate_quantity_for_product_on_order
  );
  if (minQ == null && tierP == null && aggVariant == null && aggProduct == null) return null;
  return {
    ...(minQ != null ? { minQuantity: minQ } : {}),
    ...(tierP != null ? { tierUnitPrice: tierP } : {}),
    ...(aggVariant != null ? { aggregateQuantityForVariantOnOrder: aggVariant } : {}),
    ...(aggProduct != null ? { aggregateQuantityForProductOnOrder: aggProduct } : {}),
  };
}

function readPwpRole(o: Record<string, unknown>): 'anchor' | 'companion' | undefined {
  const raw = o.role ?? o.Role;
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  const l = raw.trim().toLowerCase();
  if (l === 'anchor' || l === 'companion') return l;
  return undefined;
}

function coercePwp(raw: unknown): OrderLinePwpPrograms | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const offerId = readInt(o.offerId, o.offer_id);
  const role = readPwpRole(o);
  const anchor = readInt(o.anchorProductId, o.anchor_product_id);
  const anchorVar = readInt(o.anchorVariantId, o.anchor_variant_id);
  const companion = readInt(o.companionProductId, o.companion_product_id);
  const companionVar = readInt(o.companionVariantId, o.companion_variant_id);
  const promoP = readFinite(o.promoUnitPrice, o.promo_unit_price);
  const promoQ = readInt(o.promoQuantity, o.promo_quantity);
  const regQ = readInt(o.regularQuantity, o.regular_quantity);
  const regP = readFinite(o.regularUnitPriceAfterPrograms, o.regular_unit_price_after_programs);
  if (
    offerId == null &&
    role == null &&
    anchor == null &&
    anchorVar == null &&
    companion == null &&
    companionVar == null &&
    promoP == null &&
    promoQ == null &&
    regQ == null &&
    regP == null
  ) {
    return null;
  }
  return {
    ...(offerId != null ? { offerId } : {}),
    ...(role != null ? { role } : {}),
    ...(anchor != null ? { anchorProductId: anchor } : {}),
    ...(anchorVar != null ? { anchorVariantId: anchorVar } : {}),
    ...(companion != null ? { companionProductId: companion } : {}),
    ...(companionVar != null ? { companionVariantId: companionVar } : {}),
    ...(promoP != null ? { promoUnitPrice: promoP } : {}),
    ...(promoQ != null ? { promoQuantity: promoQ } : {}),
    ...(regQ != null ? { regularQuantity: regQ } : {}),
    ...(regP != null ? { regularUnitPriceAfterPrograms: regP } : {}),
  };
}

export function coerceOrderLinePricingPrograms(raw: unknown): OrderLinePricingPrograms | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pricedAt = readFinite(o.pricedAtEpochMs, o.priced_at_epoch_ms);
  const catalog = readFinite(o.catalogUnitPrice, o.catalog_unit_price);
  const effBefore = readFinite(
    o.effectiveUnitBeforeVolumeTier,
    o.effective_unit_before_volume_tier
  );
  const finalU = readFinite(o.finalUnitPrice, o.final_unit_price);
  const lineTot = readFinite(o.lineTotal, o.line_total);
  const pc = coercePriceChange(o.priceChange ?? o.price_change);
  const vt = coerceVolumeTier(o.volumeTier ?? o.volume_tier);
  const pwp = coercePwp(o.purchaseWithPurchase ?? o.purchase_with_purchase);

  const has =
    pricedAt != null ||
    catalog != null ||
    effBefore != null ||
    finalU != null ||
    lineTot != null ||
    pc != null ||
    vt != null ||
    pwp != null;

  if (!has) return null;

  return {
    ...(pricedAt != null ? { pricedAtEpochMs: Math.round(pricedAt) } : {}),
    ...(catalog != null ? { catalogUnitPrice: catalog } : {}),
    ...(effBefore != null ? { effectiveUnitBeforeVolumeTier: effBefore } : {}),
    ...(finalU != null ? { finalUnitPrice: finalU } : {}),
    ...(lineTot != null ? { lineTotal: lineTot } : {}),
    ...(pc ? { priceChange: pc } : {}),
    ...(vt ? { volumeTier: vt } : {}),
    ...(pwp ? { purchaseWithPurchase: pwp } : {}),
  };
}

function normalizeOrderDetailLine(row: unknown): CreatedOrderDetail | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = readInt(r.id);
  const productId = readInt(r.productId, r.product_id);
  if (id == null || productId == null) return null;

  const quantityRaw = readInt(r.quantity) ?? readFinite(r.quantity);
  const quantity =
    quantityRaw != null && quantityRaw >= 1 ? Math.max(1, Math.trunc(quantityRaw)) : 1;

  const ppRaw = r.pricingPrograms ?? r.pricing_programs;
  const pricingPrograms = coerceOrderLinePricingPrograms(ppRaw);

  return {
    id,
    productId,
    productName: readStr(r.productName, r.product_name),
    quantity,
    unitPrice: readFinite(r.unitPrice, r.unit_price),
    lineTotal: readFinite(r.lineTotal, r.line_total),
    description: (r.description as CreatedOrderDetail['description']) ?? null,
    unitId: readInt(r.unitId, r.unit_id),
    productVariantId: readInt(r.productVariantId, r.product_variant_id) ?? null,
    skuCode: readStr(r.skuCode, r.sku_code) ?? null,
    pricingPrograms: pricingPrograms ?? null,
  };
}

/** Đọc `orderDetails` / `order_details` và chuẩn hoá snake_case + `pricing_programs`. */
export function normalizeOrderDetailsFromOrder(order: OrderDto): CreatedOrderDetail[] {
  const o = order as Record<string, unknown>;
  const raw = o.orderDetails ?? o.order_details;
  if (!Array.isArray(raw)) return [];
  const out: CreatedOrderDetail[] = [];
  for (const row of raw) {
    const line = normalizeOrderDetailLine(row);
    if (line) out.push(line);
  }
  return out;
}

export function formatPricingEpochMs(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });
}

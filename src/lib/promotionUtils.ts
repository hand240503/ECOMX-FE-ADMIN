import type { ProductPriceChange, ProductVariantResponse, VolumePriceTier, PurchaseWithPurchaseProgram } from '../api/types/product.types';
import type { PaymentMethodDto } from '../api/types/order.types';

export function isPcApplicable(
  pc: ProductPriceChange | null | undefined,
  paymentMethodCode?: string | null
): boolean {
  if (!pc || !pc.enabled) return false;

  const now = Date.now();
  const start = new Date(pc.startAt).getTime();
  if (now < start) return false;
  if (pc.endAt) {
    const end = new Date(pc.endAt).getTime();
    if (now > end) return false;
  }

  if (pc.quantityLimit != null && pc.remainingQuantity != null && pc.remainingQuantity <= 0) {
    return false;
  }

  const required = pc.requiredPaymentMethodCode?.trim().toUpperCase();
  if (required) {
    if (!paymentMethodCode) return false;
    if (paymentMethodCode.trim().toUpperCase() !== required) return false;
  }

  return true;
}

export function isPcVisibleOnCard(pc: ProductPriceChange | null | undefined): boolean {
  if (!pc || !pc.enabled) return false;
  const now = Date.now();
  const start = new Date(pc.startAt).getTime();
  if (now < start) return false;
  if (pc.endAt) {
    const end = new Date(pc.endAt).getTime();
    if (now > end) return false;
  }
  if (pc.quantityLimit != null && pc.remainingQuantity != null && pc.remainingQuantity <= 0) {
    return false;
  }
  return true;
}

export function getPcEffectivePrice(pc: ProductPriceChange): number {
  return pc.salePrice != null ? pc.salePrice : pc.basePrice;
}

export function resolveDisplayPrice(
  variant: ProductVariantResponse,
  paymentMethodCode?: string | null
): { price: number; originalPrice: number | null; isPromo: boolean; pc: ProductPriceChange | null } {
  const pc = variant.activePriceChange ?? null;
  const catalogPrice = variant.prices?.[0]?.currentValue ?? variant.effectiveUnitPrice ?? 0;

  if (pc && isPcVisibleOnCard(pc)) {
    const promoPrice = getPcEffectivePrice(pc);
    const required = pc.requiredPaymentMethodCode?.trim().toUpperCase();

    if (!required) {
      return { price: promoPrice, originalPrice: catalogPrice, isPromo: true, pc };
    }

    const matchesPayment = paymentMethodCode?.trim().toUpperCase() === required;
    if (matchesPayment) {
      return { price: promoPrice, originalPrice: catalogPrice, isPromo: true, pc };
    }

    return { price: catalogPrice, originalPrice: null, isPromo: false, pc };
  }

  const effectivePrice = variant.effectiveUnitPrice ?? catalogPrice;
  return { price: effectivePrice, originalPrice: null, isPromo: false, pc: null };
}

export function getBestVolumeTier(
  tiers: VolumePriceTier[] | null | undefined,
  quantity: number
): VolumePriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers
    .filter((t) => t.enabled && quantity >= t.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0] ?? null;
}

export function getNextVolumeTier(
  tiers: VolumePriceTier[] | null | undefined,
  quantity: number
): VolumePriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers
    .filter((t) => t.enabled && t.minQuantity > quantity)
    .sort((a, b) => a.minQuantity - b.minQuantity)[0] ?? null;
}

export function hasPcForPaymentMethod(
  pc: ProductPriceChange | null | undefined,
  code: string
): boolean {
  if (!isPcVisibleOnCard(pc)) return false;
  const required = pc!.requiredPaymentMethodCode?.trim().toUpperCase();
  return required === code.trim().toUpperCase();
}

export function enrichPaymentMethodsWithPcBenefit(
  methods: PaymentMethodDto[],
  pcs: (ProductPriceChange | null | undefined)[]
): (PaymentMethodDto & { hasPcDiscount: boolean; pcDiscountLabel: string })[] {
  const activePcs = pcs.filter((pc): pc is ProductPriceChange => isPcVisibleOnCard(pc));

  return methods.map((m) => {
    const matchingPcs = activePcs.filter(
      (pc) => pc.requiredPaymentMethodCode?.trim().toUpperCase() === m.code.toUpperCase()
    );
    const hasPcDiscount = matchingPcs.length > 0;
    let pcDiscountLabel = '';
    if (hasPcDiscount) {
      pcDiscountLabel = `Giá Flash Sale khi thanh toán bằng ${m.name}`;
    }
    return { ...m, hasPcDiscount, pcDiscountLabel };
  });
}

export function getAnchorPwp(
  programs: PurchaseWithPurchaseProgram[] | null | undefined
): PurchaseWithPurchaseProgram | null {
  return programs?.find((p) => p.role === 'anchor' && p.enabled !== false) ?? null;
}

export function getCompanionPwp(
  programs: PurchaseWithPurchaseProgram[] | null | undefined
): PurchaseWithPurchaseProgram | null {
  return programs?.find((p) => p.role === 'companion' && p.enabled !== false) ?? null;
}

export function discountPercent(original: number, promo: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - promo) / original) * 100);
}

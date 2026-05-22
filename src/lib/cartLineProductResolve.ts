import type { ProductFullResponse, ProductPrice } from '../api/types/product.types';

export function productPriceForUnit(
  p: ProductFullResponse | undefined,
  unitId: number
): ProductPrice | null {
  if (!p?.prices?.length) return null;
  return p.prices.find((row) => row.unitId === unitId) ?? null;
}

export function currentUnitPrice(p: ProductFullResponse | undefined, unitId: number): number {
  const row = productPriceForUnit(p, unitId);
  return row ? row.currentValue : 0;
}

export function currentUnitName(p: ProductFullResponse | undefined, unitId: number): string {
  const row = productPriceForUnit(p, unitId);
  return row?.unitName?.trim() ? row.unitName.trim() : '—';
}

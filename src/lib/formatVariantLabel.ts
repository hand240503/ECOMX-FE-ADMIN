import type { ProductVariantResponse } from '../api/types/product.types';

export function formatVariantPickLabel(v: ProductVariantResponse): string {
  const opts = Object.entries(v.optionValues ?? {})
    .map(([k, val]) => `${k}: ${val}`)
    .join(' · ');
  const tail = opts ? ` · ${opts}` : '';
  return `${v.skuCode} (ID ${v.id})${tail}`;
}

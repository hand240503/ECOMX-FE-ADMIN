import type { ProductFullResponse } from '../api/types/product.types';

/** Giá VNĐ — dùng thống nhất PDP / card (UI.md §6.2). Luôn là số nguyên, không hiển thị thập phân. */
export function formatPrice(amount: number): string {
  const n = Math.round(Number.isFinite(amount) ? amount : 0);
  return `${n.toLocaleString('vi-VN')} ₫`;
}

/**
 * Admin list / picker: ưu tiên `from_effective_unit_price` (giá khách đã resolve), fallback dòng catalog giá niêm yết.
 */
export function formatProductListPriceLabel(p: ProductFullResponse): string {
  const raw = p as unknown as Record<string, unknown>;
  const fromEff = raw.fromEffectiveUnitPrice ?? raw.from_effective_unit_price;
  const n = Number(fromEff);
  if (Number.isFinite(n) && n >= 0) {
    return `Từ ${formatPrice(n)}`;
  }
  const row = p.prices?.[0];
  if (!row) return '—';
  const name = row.unitName?.trim() ? ` / ${row.unitName}` : '';
  return `${formatPrice(row.currentValue)}${name}`;
}
/** Số nguyên VNĐ chỉ nhóm phần nghìn (vd. 20690000 → "20.690.000"), không hậu tố — dùng ô nhập giá admin. */
export function formatIntegerViVN(amount: number): string {
  const n = Math.round(Number.isFinite(amount) ? amount : 0);
  return n.toLocaleString('vi-VN');
}

/** Ví dụ: 1200 → "1.2k" cho badge đã bán */
export function formatShortCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.floor(n));
}

import type { PolicyResponse } from '../api/types/product.types';
import { formatPrice } from './formatPrice';

export type PolicyDisplayIcon = 'truck' | 'refresh' | 'shield' | 'percent' | 'tag' | 'sparkles';

export type PolicyBadgeVariant = 'primary' | 'warning' | 'success' | 'accent' | 'neutral';

export interface PolicyDisplayRow {
  id: number;
  policyType: string;
  icon: PolicyDisplayIcon;
  title: string;
  subtitle: string | null;
}

export interface PolicyBadgeChip {
  id: number;
  policyType: string;
  label: string;
  variant: PolicyBadgeVariant;
}

export interface PolicyDisplayLabels {
  ordersFromTemplate: string;
  saveAmountTemplate: string;
  discountPercentTemplate: string;
  returnDaysTemplate: string;
}

export function filterActivePolicies(policies: PolicyResponse[] | null | undefined): PolicyResponse[] {
  if (!Array.isArray(policies)) return [];
  return policies.filter((p) => p.active !== false);
}

function iconForType(policyType: string | null | undefined): PolicyDisplayIcon {
  switch (policyType) {
    case 'FREE_SHIPPING_MIN_ORDER':
      return 'truck';
    case 'RETURN_PERIOD_DAYS':
      return 'refresh';
    case 'WARRANTY_OR_NOTE':
      return 'shield';
    case 'PERCENT_DISCOUNT':
      return 'percent';
    case 'FIXED_AMOUNT_DISCOUNT':
      return 'tag';
    default:
      return 'sparkles';
  }
}

function badgeVariantForType(policyType: string | null | undefined): PolicyBadgeVariant {
  switch (policyType) {
    case 'FREE_SHIPPING_MIN_ORDER':
      return 'primary';
    case 'RETURN_PERIOD_DAYS':
      return 'warning';
    case 'WARRANTY_OR_NOTE':
      return 'success';
    case 'PERCENT_DISCOUNT':
    case 'FIXED_AMOUNT_DISCOUNT':
      return 'accent';
    default:
      return 'neutral';
  }
}

function primaryTitle(p: PolicyResponse): string {
  const name = p.name?.trim() ?? '';
  const textValue = p.textValue?.trim() ?? '';
  if (p.policyType === 'WARRANTY_OR_NOTE' && !name && textValue) return textValue;
  if (name) return name;
  if (textValue) return textValue;
  const code = p.code?.trim() ?? '';
  if (code) return code;
  return '—';
}

function buildSubtitle(p: PolicyResponse, labels: PolicyDisplayLabels, title: string): string | null {
  const num = p.numericValue;
  const hasNum = num != null && Number.isFinite(Number(num));
  const n = hasNum ? Math.round(Number(num)) : null;

  switch (p.policyType) {
    case 'FREE_SHIPPING_MIN_ORDER':
      if (n != null && n >= 0) {
        return labels.ordersFromTemplate.replace('{price}', formatPrice(n));
      }
      return null;
    case 'FIXED_AMOUNT_DISCOUNT':
      if (n != null && n > 0) {
        return labels.saveAmountTemplate.replace('{price}', formatPrice(n));
      }
      return null;
    case 'PERCENT_DISCOUNT':
      if (n != null) {
        return labels.discountPercentTemplate.replace(/\{n\}/g, String(n));
      }
      return null;
    case 'RETURN_PERIOD_DAYS':
      if (n != null && n > 0) {
        return labels.returnDaysTemplate.replace(/\{n\}/g, String(n));
      }
      return null;
    case 'WARRANTY_OR_NOTE':
    case 'CUSTOM':
    default: {
      const detail = p.detail?.trim() ?? '';
      if (detail && detail !== title) return detail;
      const tv = p.textValue?.trim() ?? '';
      if (tv && tv !== title) return tv;
      return null;
    }
  }
}

export function policiesToDisplayRows(
  policies: PolicyResponse[] | null | undefined,
  labels: PolicyDisplayLabels
): PolicyDisplayRow[] {
  return filterActivePolicies(policies).map((p) => {
    const title = primaryTitle(p);
    let subtitle = buildSubtitle(p, labels, title);
    if (subtitle && subtitle === title) subtitle = null;
    return {
      id: p.id,
      policyType: p.policyType ?? 'CUSTOM',
      icon: iconForType(p.policyType),
      title,
      subtitle
    };
  });
}

const BADGE_MAX_LEN = 28;

function truncateBadgeLabel(s: string): string {
  const t = s.trim();
  if (t.length <= BADGE_MAX_LEN) return t;
  return `${t.slice(0, BADGE_MAX_LEN - 1)}…`;
}

/** Chip ngắn trên PDP — tối đa `max` cái, giữ thứ tự API. */
export function policiesToBadgeChips(
  policies: PolicyResponse[] | null | undefined,
  max = 4
): PolicyBadgeChip[] {
  const list = filterActivePolicies(policies);
  return list.slice(0, max).map((p) => ({
    id: p.id,
    policyType: p.policyType ?? 'CUSTOM',
    label: truncateBadgeLabel(primaryTitle(p)),
    variant: badgeVariantForType(p.policyType)
  }));
}

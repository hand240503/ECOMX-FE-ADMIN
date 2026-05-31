import { clsx } from 'clsx';
import { Gift, Layers, Zap, CreditCard } from 'lucide-react';
import type { ProductPriceChange, VolumePriceTier, PurchaseWithPurchaseProgram } from '../../api/types/product.types';
import { formatPrice } from '../../lib/formatPrice';
import { isPcVisibleOnCard } from '../../lib/promotionUtils';

type BadgeProps = { className?: string };

export function PcBadge({
  pc,
  className,
}: BadgeProps & { pc: ProductPriceChange }) {
  if (!isPcVisibleOnCard(pc)) return null;
  const hasPaymentRestriction = !!pc.requiredPaymentMethodCode?.trim();

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
        hasPaymentRestriction
          ? 'bg-blue-100 text-blue-700'
          : 'bg-[#ee4d2d] text-white',
        className
      )}
    >
      {hasPaymentRestriction ? (
        <>
          <CreditCard className="size-3 shrink-0" />
          Flash Sale {pc.requiredPaymentMethodCode}
        </>
      ) : (
        <>
          <Zap className="size-3 shrink-0" />
          Flash Sale
        </>
      )}
    </span>
  );
}

export function PcPaymentRequiredNote({
  pc,
  className,
}: BadgeProps & { pc: ProductPriceChange }) {
  const required = pc.requiredPaymentMethodCode?.trim();
  if (!required) return null;
  return (
    <p
      className={clsx(
        'flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-700',
        className
      )}
    >
      <CreditCard className="size-3 shrink-0" />
      Giá Flash Sale chỉ áp dụng khi thanh toán bằng&nbsp;<strong>{required}</strong>
    </p>
  );
}

export function VolumeBadge({
  tiers,
  className,
}: BadgeProps & { tiers: VolumePriceTier[] }) {
  const cheapest = tiers
    .filter((t) => t.enabled)
    .sort((a, b) => a.unitPrice - b.unitPrice)[0];
  if (!cheapest) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white',
        className
      )}
    >
      <Layers className="size-3 shrink-0" />
      Mua nhiều giảm thêm
    </span>
  );
}

export function PwpAnchorBadge({
  program,
  className,
}: BadgeProps & { program: PurchaseWithPurchaseProgram }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded bg-purple-600 px-2 py-0.5 text-[11px] font-semibold text-white',
        className
      )}
    >
      <Gift className="size-3 shrink-0" />
      Mua kèm ưu đãi
    </span>
  );
}

export function PwpCompanionBadge({
  promoPrice,
  className,
}: BadgeProps & { promoPrice: number }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border border-purple-400 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700',
        className
      )}
    >
      <Gift className="size-3 shrink-0" />
      Giá mua kèm {formatPrice(promoPrice)}
    </span>
  );
}

export function VolumeTierTable({
  tiers,
  currentQty,
  className,
}: BadgeProps & { tiers: VolumePriceTier[]; currentQty?: number }) {
  const sorted = [...tiers].filter((t) => t.enabled).sort((a, b) => a.minQuantity - b.minQuantity);
  if (sorted.length === 0) return null;
  return (
    <div className={clsx('rounded-lg border border-orange-200 bg-orange-50 p-3', className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700">
        <Layers className="size-3.5" />
        Ưu đãi mua nhiều
      </p>
      <div className="space-y-1">
        {sorted.map((tier) => {
          const isActive = currentQty != null && currentQty >= tier.minQuantity;
          return (
            <div
              key={tier.id}
              className={clsx(
                'flex items-center justify-between rounded px-2 py-1 text-xs',
                isActive ? 'bg-orange-200 font-semibold text-orange-900' : 'text-orange-800'
              )}
            >
              <span>Mua từ {tier.minQuantity} cái</span>
              <span>{formatPrice(tier.unitPrice)}/cái</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

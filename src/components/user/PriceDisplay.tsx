import { clsx } from 'clsx';
import { Zap } from 'lucide-react';
import { formatPrice } from '../../lib/formatPrice';
import type { ProductPriceChange } from '../../api/types/product.types';
import { isPcVisibleOnCard, getPcEffectivePrice, discountPercent } from '../../lib/promotionUtils';

type PriceDisplayProps = {
  catalogPrice: number;
  pc?: ProductPriceChange | null;
  selectedPaymentMethodCode?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function PriceDisplay({
  catalogPrice,
  pc,
  selectedPaymentMethodCode,
  size = 'md',
  className,
}: PriceDisplayProps) {
  const sizeMap = {
    sm: { main: 'text-base font-bold', old: 'text-xs', badge: 'text-[10px] px-1.5 py-0.5' },
    md: { main: 'text-lg font-bold', old: 'text-sm', badge: 'text-xs px-2 py-0.5' },
    lg: { main: 'text-2xl font-bold', old: 'text-base', badge: 'text-xs px-2 py-0.5' },
  };
  const cls = sizeMap[size];

  const hasActivePc = isPcVisibleOnCard(pc);
  if (!hasActivePc || !pc) {
    return (
      <span className={clsx('text-[#ee4d2d]', cls.main, className)}>
        {formatPrice(catalogPrice)}
      </span>
    );
  }

  const promoPrice = getPcEffectivePrice(pc);
  const requiredCode = pc.requiredPaymentMethodCode?.trim().toUpperCase();
  const isRestrictedToPayment = !!requiredCode;
  const paymentMatches =
    !isRestrictedToPayment ||
    (selectedPaymentMethodCode?.trim().toUpperCase() === requiredCode);

  const pct = discountPercent(catalogPrice, promoPrice);

  if (!paymentMatches) {
    return (
      <div className={clsx('flex flex-col gap-0.5', className)}>
        <span className={clsx('text-gray-800', cls.main)}>{formatPrice(catalogPrice)}</span>
        <span className={clsx('flex items-center gap-1 text-[#ee4d2d]', cls.badge)}>
          <Zap className="size-3 shrink-0" />
          <span>
            {formatPrice(promoPrice)} khi thanh toán bằng{' '}
            <strong>{pc.requiredPaymentMethodCode}</strong>
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-2">
        <span className={clsx('text-[#ee4d2d]', cls.main)}>{formatPrice(promoPrice)}</span>
        {pct > 0 && (
          <span
            className={clsx(
              'inline-flex items-center rounded bg-[#ee4d2d] font-semibold text-white',
              cls.badge
            )}
          >
            -{pct}%
          </span>
        )}
      </div>
      <span className={clsx('text-gray-400 line-through', cls.old)}>
        {formatPrice(catalogPrice)}
      </span>
    </div>
  );
}

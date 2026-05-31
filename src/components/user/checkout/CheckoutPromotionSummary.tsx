import { clsx } from 'clsx';
import { Zap, Layers, Gift, TrendingDown } from 'lucide-react';
import type { CheckoutPricingPreview } from '../../../api/types/checkout.types';
import { formatPrice } from '../../../lib/formatPrice';

type CheckoutPromotionSummaryProps = {
  preview: CheckoutPricingPreview;
  shippingFee?: number | null;
  className?: string;
};

export function CheckoutPromotionSummary({
  preview,
  shippingFee,
  className,
}: CheckoutPromotionSummaryProps) {
  let totalCatalog = 0;
  let hasPc = false;
  let hasVolume = false;
  let hasPwp = false;
  let pcSaving = 0;
  let volumeSaving = 0;
  let pwpSaving = 0;

  for (const line of preview.lines) {
    const p = line.pricing_programs;
    const catalogTotal = (p?.catalogUnitPrice ?? line.unit_price) * line.quantity;
    totalCatalog += catalogTotal;

    if (p?.price_change) {
      hasPc = true;
      const beforePcTotal = (p.effectiveUnitBeforeVolumeTier ?? p.catalogUnitPrice ?? line.unit_price) * line.quantity;
      const pcResolvedTotal = (p.price_change.resolvedUnitPrice ?? p.catalogUnitPrice ?? line.unit_price) * line.quantity;
      if (beforePcTotal > pcResolvedTotal) pcSaving += beforePcTotal - pcResolvedTotal;
    }

    if (p?.volume_tier) {
      hasVolume = true;
      const beforeVol = (p.effectiveUnitBeforeVolumeTier ?? p.catalogUnitPrice ?? line.unit_price) * line.quantity;
      const afterVol = (p.volume_tier.tierUnitPrice ?? line.unit_price) * line.quantity;
      if (beforeVol > afterVol) volumeSaving += beforeVol - afterVol;
    }

    if (p?.purchase_with_purchase) {
      hasPwp = true;
      const pwp = p.purchase_with_purchase;
      const promoQ = pwp.promoQuantity ?? 0;
      const regularPrice = pwp.regularUnitPriceAfterPrograms ?? line.unit_price;
      const promoSave = promoQ * (regularPrice - (pwp.promoUnitPrice ?? 0));
      if (promoSave > 0) pwpSaving += promoSave;
    }
  }

  const totalSaving = pcSaving + volumeSaving + pwpSaving;
  const finalTotal = preview.items_subtotal + (shippingFee ?? 0);

  return (
    <div className={clsx('rounded-xl border border-gray-200 bg-white p-4 space-y-3', className)}>
      <p className="text-sm font-bold text-gray-800">Tổng đơn hàng</p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Tạm tính ({preview.lines.length} sản phẩm)</span>
          <span>{formatPrice(totalCatalog)}</span>
        </div>

        {hasPc && pcSaving > 0 && (
          <div className="flex items-center justify-between text-[#ee4d2d]">
            <span className="flex items-center gap-1">
              <Zap className="size-3.5" />
              Giảm Flash Sale
            </span>
            <span className="font-semibold">-{formatPrice(pcSaving)}</span>
          </div>
        )}

        {hasVolume && volumeSaving > 0 && (
          <div className="flex items-center justify-between text-orange-600">
            <span className="flex items-center gap-1">
              <Layers className="size-3.5" />
              Giảm mua nhiều
            </span>
            <span className="font-semibold">-{formatPrice(volumeSaving)}</span>
          </div>
        )}

        {hasPwp && pwpSaving > 0 && (
          <div className="flex items-center justify-between text-purple-600">
            <span className="flex items-center gap-1">
              <Gift className="size-3.5" />
              Giảm mua kèm
            </span>
            <span className="font-semibold">-{formatPrice(pwpSaving)}</span>
          </div>
        )}

        {shippingFee != null && (
          <div className="flex justify-between text-gray-600">
            <span>Phí vận chuyển</span>
            <span>{shippingFee > 0 ? formatPrice(shippingFee) : 'Miễn phí'}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">Tổng cộng</span>
        <span className="text-xl font-bold text-[#ee4d2d]">{formatPrice(finalTotal)}</span>
      </div>

      {totalSaving > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          <TrendingDown className="size-3.5 shrink-0" />
          Bạn tiết kiệm được {formatPrice(totalSaving)} so với giá niêm yết
        </div>
      )}
    </div>
  );
}

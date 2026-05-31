import { clsx } from 'clsx';
import { Zap, Layers, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { CheckoutPricingLineItem } from '../../../api/types/checkout.types';
import { formatPrice } from '../../../lib/formatPrice';

type CheckoutPricingLineProps = {
  line: CheckoutPricingLineItem;
  className?: string;
};

export function CheckoutPricingLine({ line, className }: CheckoutPricingLineProps) {
  const [expanded, setExpanded] = useState(false);
  const p = line.pricing_programs;
  const hasDiscount =
    p != null &&
    p.catalogUnitPrice != null &&
    p.finalUnitPrice != null &&
    p.finalUnitPrice < p.catalogUnitPrice;

  const hasPc = p?.price_change != null;
  const hasVolume = p?.volume_tier != null;
  const hasPwp = p?.purchase_with_purchase != null;
  const hasAnyProgram = hasPc || hasVolume || hasPwp;

  const optionText = line.variant_options
    ? Object.values(line.variant_options).join(' / ')
    : null;

  return (
    <div className={clsx('rounded-xl border border-gray-100 bg-white p-3 shadow-sm', className)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 line-clamp-2">{line.product_name}</p>
          {optionText && (
            <p className="mt-0.5 text-xs text-gray-500">{optionText}</p>
          )}
          {line.variant_sku_code && (
            <p className="mt-0.5 font-mono text-[10px] text-gray-400">SKU: {line.variant_sku_code}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {hasPc && (
              <span className="inline-flex items-center gap-1 rounded bg-[#ee4d2d] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Zap className="size-2.5" /> Flash Sale
              </span>
            )}
            {hasVolume && (
              <span className="inline-flex items-center gap-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Layers className="size-2.5" /> Mua nhiều giảm
              </span>
            )}
            {hasPwp && (
              <span className="inline-flex items-center gap-1 rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Gift className="size-2.5" /> Mua kèm
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-400">x{line.quantity}</p>
          {hasDiscount ? (
            <>
              <p className="text-xs text-gray-400 line-through">
                {formatPrice(p!.catalogUnitPrice! * line.quantity)}
              </p>
              <p className="text-base font-bold text-[#ee4d2d]">
                {formatPrice(line.line_total)}
              </p>
            </>
          ) : (
            <p className="text-base font-bold text-gray-800">
              {formatPrice(line.line_total)}
            </p>
          )}
        </div>
      </div>

      {hasAnyProgram && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Chi tiết giá khuyến mãi
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 text-xs">
              {p?.catalogUnitPrice != null && (
                <Row label="Giá niêm yết" value={formatPrice(p.catalogUnitPrice)} muted />
              )}

              {hasPc && p?.price_change != null && (
                <div className="rounded-md bg-red-50 p-2 space-y-1">
                  <p className="font-semibold text-[#ee4d2d] flex items-center gap-1">
                    <Zap className="size-3" /> Flash Sale
                  </p>
                  {p.price_change.basePrice != null && (
                    <Row label="Giá cơ sở PC" value={formatPrice(p.price_change.basePrice)} />
                  )}
                  {p.price_change.salePrice != null && (
                    <Row label="Giá Flash Sale" value={formatPrice(p.price_change.salePrice)} highlight />
                  )}
                  {p.price_change.requiredPaymentMethodCode && (
                    <p className="text-[10px] text-gray-500">
                      * Chỉ áp dụng với {p.price_change.requiredPaymentMethodCode}
                    </p>
                  )}
                </div>
              )}

              {hasVolume && p?.volume_tier != null && (
                <div className="rounded-md bg-orange-50 p-2 space-y-1">
                  <p className="font-semibold text-orange-700 flex items-center gap-1">
                    <Layers className="size-3" /> Giá mua nhiều
                  </p>
                  {p.volume_tier.minQuantity != null && (
                    <Row label="Mua từ" value={`${p.volume_tier.aggregateQuantityForVariantOnOrder ?? '?'} / ${p.volume_tier.minQuantity} sản phẩm`} />
                  )}
                  {p.volume_tier.tierUnitPrice != null && (
                    <Row label="Đơn giá tier" value={formatPrice(p.volume_tier.tierUnitPrice)} highlight />
                  )}
                </div>
              )}

              {hasPwp && p?.purchase_with_purchase != null && (
                <div className="rounded-md bg-purple-50 p-2 space-y-1">
                  <p className="font-semibold text-purple-700 flex items-center gap-1">
                    <Gift className="size-3" /> Mua kèm
                  </p>
                  {p.purchase_with_purchase.promoQuantity != null && p.purchase_with_purchase.promoQuantity > 0 && (
                    <Row label={`${p.purchase_with_purchase.promoQuantity} sản phẩm giá kèm`} value={formatPrice(p.purchase_with_purchase.promoUnitPrice ?? 0)} highlight />
                  )}
                  {p.purchase_with_purchase.regularQuantity != null && p.purchase_with_purchase.regularQuantity > 0 && (
                    <Row label={`${p.purchase_with_purchase.regularQuantity} sản phẩm giá thường`} value={formatPrice(p.purchase_with_purchase.regularUnitPriceAfterPrograms ?? 0)} />
                  )}
                </div>
              )}

              {p?.finalUnitPrice != null && (
                <Row label="Đơn giá cuối" value={`${formatPrice(p.finalUnitPrice)} x ${line.quantity}`} highlight />
              )}
              <Row label="Thành tiền" value={formatPrice(line.line_total)} highlight bold />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={clsx('text-gray-600', muted && 'line-through text-gray-400')}>{label}</span>
      <span
        className={clsx(
          bold && 'font-bold',
          highlight ? 'text-[#ee4d2d] font-semibold' : muted ? 'text-gray-400 line-through' : 'text-gray-800'
        )}
      >
        {value}
      </span>
    </div>
  );
}

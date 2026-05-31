import { clsx } from 'clsx';
import { ShoppingCart, Star } from 'lucide-react';
import type { ProductFullResponse, ProductVariantResponse } from '../../api/types/product.types';
import { formatPrice, formatShortCount } from '../../lib/formatPrice';
import {
  isPcVisibleOnCard,
  getPcEffectivePrice,
  resolveDisplayPrice,
  getAnchorPwp,
  getCompanionPwp,
  discountPercent,
} from '../../lib/promotionUtils';
import { PcBadge, PcPaymentRequiredNote, VolumeBadge, PwpAnchorBadge, PwpCompanionBadge } from './PromotionBadges';

type ProductCardProps = {
  product: ProductFullResponse;
  selectedPaymentMethodCode?: string | null;
  onAddToCart?: (product: ProductFullResponse, variant: ProductVariantResponse) => void;
  onClick?: (product: ProductFullResponse) => void;
  className?: string;
};

function pickCheapestVariant(product: ProductFullResponse): ProductVariantResponse | null {
  const active = product.variants?.filter((v) => v.active) ?? [];
  if (active.length === 0) return null;

  return active.reduce<ProductVariantResponse>((best, v) => {
    const bestPrice = best.effectiveUnitPrice ?? best.prices?.[0]?.currentValue ?? Infinity;
    const vPrice = v.effectiveUnitPrice ?? v.prices?.[0]?.currentValue ?? Infinity;
    return vPrice < bestPrice ? v : best;
  }, active[0]);
}

export function ProductCard({
  product,
  selectedPaymentMethodCode,
  onAddToCart,
  onClick,
  className,
}: ProductCardProps) {
  const variant = pickCheapestVariant(product);
  const pc = variant?.activePriceChange ?? null;
  const hasActivePc = isPcVisibleOnCard(pc);

  const catalogPrice =
    (variant ? (variant.prices?.[0]?.currentValue ?? variant.effectiveUnitPrice ?? 0) : 0);

  const promoPrice = hasActivePc && pc ? getPcEffectivePrice(pc) : null;
  const pct = promoPrice != null ? discountPercent(catalogPrice, promoPrice) : 0;

  const requiredCode = pc?.requiredPaymentMethodCode?.trim().toUpperCase();
  const isPcLockedToPayment = !!requiredCode;
  const paymentUnlocksPc =
    isPcLockedToPayment &&
    selectedPaymentMethodCode?.trim().toUpperCase() === requiredCode;

  const effectiveDisplayPrice =
    hasActivePc && pc && (!isPcLockedToPayment || paymentUnlocksPc)
      ? (promoPrice ?? catalogPrice)
      : (product.fromEffectiveUnitPrice ?? catalogPrice);

  const anchorPwp = getAnchorPwp(product.purchaseWithPurchasePrograms);
  const companionPwp = getCompanionPwp(product.purchaseWithPurchasePrograms);

  const hasTiers =
    (product.volumePriceTiers?.filter((t) => t.enabled) ?? []).length > 0 ||
    (variant?.volumePriceTiers?.filter((t) => t.enabled) ?? []).length > 0;

  const imageUrl =
    product.mainImageUrl ?? product.imageUrl ?? product.coverImageUrl ?? product.thumbnailUrl;

  const handleClick = () => onClick?.(product);
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (variant) onAddToCart?.(product, variant);
  };

  return (
    <div
      className={clsx(
        'group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-sm',
        'border border-gray-100 transition-shadow hover:shadow-md',
        'cursor-pointer',
        className
      )}
      onClick={handleClick}
      role="article"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.productName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300 text-sm">
            Chưa có ảnh
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hasActivePc && pc && (
            <PcBadge pc={pc} />
          )}
          {anchorPwp && !hasActivePc && <PwpAnchorBadge program={anchorPwp} />}
          {companionPwp && !hasActivePc && !anchorPwp && (
            <PwpCompanionBadge promoPrice={companionPwp.promoUnitPrice ?? 0} />
          )}
          {hasTiers && !hasActivePc && !anchorPwp && !companionPwp && (
            <VolumeBadge
              tiers={
                product.volumePriceTiers?.filter((t) => t.enabled) ??
                variant?.volumePriceTiers?.filter((t) => t.enabled) ??
                []
              }
            />
          )}
        </div>

        {pct > 0 && (!isPcLockedToPayment || paymentUnlocksPc) && (
          <div className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-[#ee4d2d] text-[11px] font-bold text-white shadow">
            -{pct}%
          </div>
        )}

        {onAddToCart && (
          <button
            onClick={handleAddToCart}
            className={clsx(
              'absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2',
              'bg-[#ee4d2d] py-2 text-sm font-semibold text-white',
              'translate-y-full transition-transform duration-200 group-hover:translate-y-0'
            )}
          >
            <ShoppingCart className="size-4" />
            Thêm vào giỏ
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm text-gray-800 leading-snug">
          {product.productName}
        </p>

        {product.averageRating != null && product.ratingCount != null && product.ratingCount > 0 && (
          <div className="flex items-center gap-1">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-500">
              {product.averageRating.toFixed(1)} ({formatShortCount(product.ratingCount)})
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1">
          {hasActivePc && pc && (!isPcLockedToPayment || paymentUnlocksPc) ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-bold text-[#ee4d2d]">
                {formatPrice(effectiveDisplayPrice)}
              </span>
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(catalogPrice)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-[#ee4d2d]">
              {effectiveDisplayPrice > 0
                ? `Từ ${formatPrice(effectiveDisplayPrice)}`
                : '—'}
            </span>
          )}

          {hasActivePc && pc && isPcLockedToPayment && !paymentUnlocksPc && (
            <PcPaymentRequiredNote pc={pc} />
          )}

          {anchorPwp && (
            <p className="text-[11px] text-purple-600 font-medium">
              🎁 Mua kèm sản phẩm khác được giảm giá
            </p>
          )}
          {companionPwp && companionPwp.promoUnitPrice != null && (
            <p className="text-[11px] text-purple-600 font-medium">
              🎁 Giá mua kèm: {formatPrice(companionPwp.promoUnitPrice)}
            </p>
          )}
        </div>

        {product.soldCount > 0 && (
          <p className="text-[11px] text-gray-400">Đã bán {formatShortCount(product.soldCount)}</p>
        )}
      </div>
    </div>
  );
}

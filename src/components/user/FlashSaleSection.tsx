import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Zap, CreditCard, ChevronRight, Clock } from 'lucide-react';
import { getActivePromotions } from '../../api/services/productService';
import type { ProductFullResponse, ProductVariantResponse, ProductPriceChange } from '../../api/types/product.types';
import { formatPrice } from '../../lib/formatPrice';
import { isPcVisibleOnCard, getPcEffectivePrice, discountPercent } from '../../lib/promotionUtils';

type FlashSaleSectionProps = {
  selectedPaymentMethodCode?: string | null;
  onProductClick?: (product: ProductFullResponse) => void;
  onViewAll?: () => void;
  maxVisible?: number;
  className?: string;
};

function pickBestVariant(product: ProductFullResponse): ProductVariantResponse | null {
  const active = product.variants?.filter((v) => v.active) ?? [];
  if (active.length === 0) return null;
  return active.reduce<ProductVariantResponse>((best, v) => {
    const bPrice = best.effectiveUnitPrice ?? best.prices?.[0]?.currentValue ?? Infinity;
    const vPrice = v.effectiveUnitPrice ?? v.prices?.[0]?.currentValue ?? Infinity;
    return vPrice < bPrice ? v : best;
  }, active[0]);
}

function getNearestEndTime(products: ProductFullResponse[]): Date | null {
  let nearest: Date | null = null;
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const pc = v.activePriceChange;
      if (!isPcVisibleOnCard(pc) || !pc?.endAt) continue;
      const d = new Date(pc.endAt);
      if (!nearest || d < nearest) nearest = d;
    }
  }
  return nearest;
}

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(
    target ? Math.max(0, target.getTime() - Date.now()) : 0
  );

  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s), done: remaining === 0 };
}

function FlashSaleCard({
  product,
  paymentMethodCode,
  onClick,
}: {
  product: ProductFullResponse;
  paymentMethodCode?: string | null;
  onClick?: (p: ProductFullResponse) => void;
}) {
  const variant = pickBestVariant(product);
  const pc = variant?.activePriceChange ?? null;
  const isVisible = isPcVisibleOnCard(pc);

  if (!isVisible || !pc || !variant) return null;

  const promoPrice = getPcEffectivePrice(pc);
  const catalogPrice = variant.prices?.[0]?.currentValue ?? variant.effectiveUnitPrice ?? promoPrice;
  const pct = discountPercent(catalogPrice, promoPrice);

  const requiredCode = pc.requiredPaymentMethodCode?.trim().toUpperCase();
  const isPaymentRestricted = !!requiredCode;
  const paymentMatches =
    !isPaymentRestricted ||
    paymentMethodCode?.trim().toUpperCase() === requiredCode;

  const remaining = pc.remainingQuantity;
  const limit = pc.quantityLimit;
  const soldRatio =
    limit != null && limit > 0
      ? Math.min(1, ((pc.soldQuantity ?? 0) / limit))
      : null;

  const imageUrl =
    product.mainImageUrl ?? product.imageUrl ?? product.thumbnailUrl;

  return (
    <button
      type="button"
      onClick={() => onClick?.(product)}
      className={clsx(
        'group flex flex-col overflow-hidden rounded-2xl bg-white text-left',
        'border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
        'w-40 shrink-0 sm:w-44'
      )}
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
          <div className="flex h-full items-center justify-center text-gray-200 text-xs">
            Chưa có ảnh
          </div>
        )}

        {pct > 0 && (
          <div className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#ee4d2d] text-[11px] font-bold text-white shadow">
            -{pct}%
          </div>
        )}

        {isPaymentRestricted && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-blue-600/90 px-2 py-1 text-[10px] font-semibold text-white">
            <CreditCard className="size-2.5 shrink-0" />
            {requiredCode}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p className="line-clamp-2 text-xs leading-snug text-gray-700">{product.productName}</p>

        <div className="mt-auto space-y-0.5">
          {paymentMatches ? (
            <>
              <p className="text-base font-bold text-[#ee4d2d]">{formatPrice(promoPrice)}</p>
              {catalogPrice > promoPrice && (
                <p className="text-[11px] text-gray-400 line-through">{formatPrice(catalogPrice)}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-base font-bold text-gray-800">{formatPrice(catalogPrice)}</p>
              <p className="flex items-center gap-0.5 text-[10px] text-blue-600 font-medium">
                <CreditCard className="size-2.5" />
                {formatPrice(promoPrice)} khi TT bằng {requiredCode}
              </p>
            </>
          )}
        </div>

        {soldRatio !== null && (
          <div className="space-y-0.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  soldRatio > 0.8 ? 'bg-red-500' : 'bg-[#ee4d2d]'
                )}
                style={{ width: `${Math.round(soldRatio * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500">
              {soldRatio > 0.8
                ? `Chỉ còn ${remaining ?? 0} sản phẩm!`
                : `Đã bán ${Math.round(soldRatio * 100)}%`}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

export function FlashSaleSection({
  selectedPaymentMethodCode,
  onProductClick,
  onViewAll,
  maxVisible = 20,
  className,
}: FlashSaleSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['active-promotions'],
    queryFn: () => getActivePromotions(),
    staleTime: 60_000,
  });

  const allPcProducts = useMemo(() => {
    const list = data?.price_change ?? [];
    return list.filter((p) =>
      p.variants?.some((v) => isPcVisibleOnCard(v.activePriceChange))
    );
  }, [data]);

  const { generalProducts, restrictedProducts } = useMemo(() => {
    const general: ProductFullResponse[] = [];
    const restricted: ProductFullResponse[] = [];
    for (const p of allPcProducts) {
      const hasRestricted = p.variants?.some(
        (v) => isPcVisibleOnCard(v.activePriceChange) && !!v.activePriceChange?.requiredPaymentMethodCode
      );
      const hasGeneral = p.variants?.some(
        (v) => isPcVisibleOnCard(v.activePriceChange) && !v.activePriceChange?.requiredPaymentMethodCode
      );
      if (hasGeneral) general.push(p);
      else if (hasRestricted) restricted.push(p);
    }
    return { generalProducts: general, restrictedProducts: restricted };
  }, [allPcProducts]);

  const nearestEnd = useMemo(() => getNearestEndTime(allPcProducts), [allPcProducts]);
  const countdown = useCountdown(nearestEnd);

  const restrictedBuckets = useMemo(() => {
    const map = new Map<string, ProductFullResponse[]>();
    for (const p of restrictedProducts) {
      for (const v of p.variants ?? []) {
        const code = v.activePriceChange?.requiredPaymentMethodCode?.trim().toUpperCase();
        if (code && isPcVisibleOnCard(v.activePriceChange)) {
          const bucket = map.get(code) ?? [];
          if (!bucket.includes(p)) bucket.push(p);
          map.set(code, bucket);
        }
      }
    }
    return map;
  }, [restrictedProducts]);

  if (isLoading) {
    return (
      <div className={clsx('rounded-2xl bg-gradient-to-r from-[#ee4d2d] to-orange-400 p-4', className)}>
        <div className="flex items-center gap-2 text-white">
          <Zap className="size-5 animate-pulse" />
          <span className="text-lg font-bold">Flash Sale</span>
        </div>
        <div className="mt-4 flex gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-52 w-40 animate-pulse rounded-2xl bg-white/20" />
          ))}
        </div>
      </div>
    );
  }

  if (allPcProducts.length === 0) return null;

  return (
    <div className={clsx('overflow-hidden rounded-2xl', className)}>
      <div className="bg-gradient-to-r from-[#ee4d2d] to-orange-400 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-5 fill-yellow-300 text-yellow-300" />
            <span className="text-xl font-extrabold tracking-tight text-white">FLASH SALE</span>
          </div>

          <div className="flex items-center gap-1.5">
            {nearestEnd && !countdown.done && (
              <div className="flex items-center gap-1 rounded-lg bg-black/20 px-2 py-1">
                <Clock className="size-3 text-white/80" />
                <div className="flex items-center gap-0.5 font-mono text-sm font-bold text-white">
                  <span className="rounded bg-black/30 px-1">{countdown.h}</span>
                  <span>:</span>
                  <span className="rounded bg-black/30 px-1">{countdown.m}</span>
                  <span>:</span>
                  <span className="rounded bg-black/30 px-1">{countdown.s}</span>
                </div>
              </div>
            )}
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="flex items-center gap-0.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30"
              >
                Xem tất cả <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#fff3f0] px-4 pb-4 pt-3 space-y-5">
        {generalProducts.length > 0 && (
          <div>
            {restrictedBuckets.size > 0 && (
              <p className="mb-2 text-xs font-semibold text-[#ee4d2d] uppercase tracking-wide">
                Tất cả phương thức thanh toán
              </p>
            )}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {generalProducts.slice(0, maxVisible).map((p) => (
                <FlashSaleCard
                  key={p.id}
                  product={p}
                  paymentMethodCode={selectedPaymentMethodCode}
                  onClick={onProductClick}
                />
              ))}
            </div>
          </div>
        )}

        {[...restrictedBuckets.entries()].map(([code, products]) => (
          <div key={code}>
            <div className="mb-2 flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Flash Sale độc quyền {code}
              </p>
              {selectedPaymentMethodCode?.trim().toUpperCase() === code && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Đang áp dụng
                </span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {products.slice(0, maxVisible).map((p) => (
                <FlashSaleCard
                  key={p.id}
                  product={p}
                  paymentMethodCode={selectedPaymentMethodCode}
                  onClick={onProductClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

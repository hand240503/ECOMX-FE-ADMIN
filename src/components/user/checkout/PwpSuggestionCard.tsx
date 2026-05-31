import { clsx } from 'clsx';
import { Gift, Plus, ShoppingBag } from 'lucide-react';
import type { PwpSuggestion } from '../../../api/types/checkout.types';
import { formatPrice } from '../../../lib/formatPrice';
import { discountPercent } from '../../../lib/promotionUtils';

type PwpSuggestionCardProps = {
  suggestion: PwpSuggestion;
  onAdd?: (suggestion: PwpSuggestion) => void;
  className?: string;
};

export function PwpSuggestionCard({
  suggestion,
  onAdd,
  className,
}: PwpSuggestionCardProps) {
  const pct = discountPercent(suggestion.companion_regular_price, suggestion.promo_unit_price);
  const optionText = suggestion.companion_variant_options
    ? Object.values(suggestion.companion_variant_options).join(' / ')
    : null;

  const unitsPerAnchor = suggestion.companion_promo_units_per_anchor;
  const minAnchor = suggestion.min_anchor_quantity;

  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3',
        className
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
        <Gift className="size-4" />
      </div>

      <div className="flex flex-1 items-start gap-3 min-w-0">
        {suggestion.companion_thumbnail_url ? (
          <img
            src={suggestion.companion_thumbnail_url}
            alt={suggestion.companion_product_name}
            className="size-14 shrink-0 rounded-lg object-cover border border-purple-100"
            loading="lazy"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-300">
            <ShoppingBag className="size-6" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-500 mb-0.5">
            Mua kèm ưu đãi
          </p>
          <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
            {suggestion.companion_product_name}
          </p>
          {optionText && (
            <p className="text-xs text-gray-500 mt-0.5">{optionText}</p>
          )}

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-purple-700">
              {formatPrice(suggestion.promo_unit_price)}
            </span>
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(suggestion.companion_regular_price)}
            </span>
            {pct > 0 && (
              <span className="inline-flex items-center rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                -{pct}%
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] text-purple-600">
            {unitsPerAnchor > 1
              ? `Mua {unitsPerAnchor} sản phẩm này khi mua từ ${minAnchor} sản phẩm neo`
              : `Ưu đãi khi mua từ ${minAnchor} sản phẩm neo`}
            {suggestion.max_companion_promo_units != null && (
              <span> · tối đa {suggestion.max_companion_promo_units} sản phẩm</span>
            )}
          </p>
        </div>
      </div>

      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(suggestion)}
          className={clsx(
            'mt-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2',
            'text-xs font-semibold text-white transition-colors hover:bg-purple-700 active:scale-95'
          )}
        >
          <Plus className="size-3.5" />
          Thêm
        </button>
      )}
    </div>
  );
}

type PwpSuggestionBannerProps = {
  suggestions: PwpSuggestion[];
  onAdd?: (suggestion: PwpSuggestion) => void;
  className?: string;
};

export function PwpSuggestionBanner({
  suggestions,
  onAdd,
  className,
}: PwpSuggestionBannerProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className={clsx('space-y-2', className)}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-purple-700">
        <Gift className="size-4" />
        Mua kèm được giảm giá
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <PwpSuggestionCard key={s.offer_id} suggestion={s} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

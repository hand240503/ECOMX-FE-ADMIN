import { clsx } from 'clsx';
import { CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import type { ProductPriceChange } from '../../../api/types/product.types';
import type { PaymentMethodDto } from '../../../api/types/order.types';
import { formatPrice } from '../../../lib/formatPrice';
import { isPcVisibleOnCard, getPcEffectivePrice, enrichPaymentMethodsWithPcBenefit } from '../../../lib/promotionUtils';

type PaymentMethodPickerProps = {
  methods: PaymentMethodDto[];
  selectedId: number | null;
  onSelect: (method: PaymentMethodDto) => void;
  activePcs?: (ProductPriceChange | null | undefined)[];
  className?: string;
};

export function PaymentMethodPicker({
  methods,
  selectedId,
  onSelect,
  activePcs = [],
  className,
}: PaymentMethodPickerProps) {
  const enriched = enrichPaymentMethodsWithPcBenefit(methods, activePcs);

  return (
    <div className={clsx('space-y-2', className)}>
      <p className="text-sm font-semibold text-gray-700">Phương thức thanh toán</p>
      <div className="flex flex-col gap-2">
        {enriched.map((m) => {
          const isSelected = m.id === selectedId;

          const matchingPcs = activePcs
            .filter((pc): pc is ProductPriceChange => isPcVisibleOnCard(pc))
            .filter(
              (pc) => pc.requiredPaymentMethodCode?.trim().toUpperCase() === m.code.toUpperCase()
            );

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className={clsx(
                'flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-all',
                isSelected
                  ? 'border-[#ee4d2d] bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div
                className={clsx(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                  isSelected ? 'bg-[#ee4d2d] text-white' : 'bg-gray-100 text-gray-500'
                )}
              >
                <CreditCard className="size-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                  {isSelected && (
                    <CheckCircle2 className="size-4 shrink-0 text-[#ee4d2d]" />
                  )}
                </div>

                {m.hasPcDiscount && matchingPcs.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {matchingPcs.map((pc) => {
                      const promoPrice = getPcEffectivePrice(pc);
                      return (
                        <div
                          key={pc.id}
                          className={clsx(
                            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold',
                            isSelected
                              ? 'bg-red-100 text-[#ee4d2d]'
                              : 'bg-blue-50 text-blue-700'
                          )}
                        >
                          <Zap className="size-3 shrink-0" />
                          <span>
                            Flash Sale: {formatPrice(promoPrice)}
                            {pc.quantityLimit != null && pc.remainingQuantity != null && (
                              <span className="ml-1 opacity-70">
                                · còn {pc.remainingQuantity}/{pc.quantityLimit} suất
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

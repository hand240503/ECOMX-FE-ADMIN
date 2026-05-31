import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';
import type { ProductFullResponse, ProductVariantResponse } from '../../../api/types/product.types';
import type { PaymentMethodDto } from '../../../api/types/order.types';
import type { PwpSuggestion } from '../../../api/types/checkout.types';
import { formatPrice } from '../../../lib/formatPrice';
import { useCheckoutPricing } from '../../../hooks/useCheckoutPricing';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { PwpSuggestionBanner } from './PwpSuggestionCard';
import { CheckoutPricingLine } from './CheckoutPricingLine';
import { CheckoutPromotionSummary } from './CheckoutPromotionSummary';

export type CartItem = {
  product: ProductFullResponse;
  variant: ProductVariantResponse;
  quantity: number;
};

type CheckoutPageProps = {
  cartItems: CartItem[];
  paymentMethods: PaymentMethodDto[];
  shippingFee?: number | null;
  onPwpAdd?: (suggestion: PwpSuggestion) => void;
  onSubmit?: (paymentMethodId: number) => void;
  isSubmitting?: boolean;
  className?: string;
};

export function CheckoutPage({
  cartItems,
  paymentMethods,
  shippingFee,
  onPwpAdd,
  onSubmit,
  isSubmitting,
  className,
}: CheckoutPageProps) {
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(
    paymentMethods[0]?.id ?? null
  );

  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId) ?? null;

  const cartLines = useMemo(
    () =>
      cartItems.map((item) => ({
        productId: item.product.id,
        variant: item.variant,
        quantity: item.quantity,
      })),
    [cartItems]
  );

  const activePcs = useMemo(
    () => cartLines.flatMap((l) => (l.variant.activePriceChange ? [l.variant.activePriceChange] : [])),
    [cartLines]
  );

  const { preview, isLoading, isError, hasPcWithPaymentRestriction } = useCheckoutPricing({
    cartLines,
    paymentMethods,
    enabled: cartItems.length > 0,
  });

  const handleSubmit = () => {
    if (selectedPaymentMethodId != null) onSubmit?.(selectedPaymentMethodId);
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <ShoppingBag className="size-12 opacity-30" />
        <p className="text-sm">Giỏ hàng của bạn đang trống</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6', className)}>
      {/* LEFT: danh sách sản phẩm + PWP + chọn thanh toán */}
      <div className="flex flex-1 flex-col gap-4">
        <section>
          <h2 className="mb-2 text-base font-bold text-gray-800">
            Sản phẩm ({cartItems.length})
          </h2>

          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              Đang tính giá khuyến mãi…
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 mb-2">
              <AlertCircle className="size-4 shrink-0" />
              Không tải được thông tin giá. Hiển thị giá niêm yết.
            </div>
          )}

          <div className="space-y-2">
            {preview
              ? preview.lines.map((line) => (
                  <CheckoutPricingLine
                    key={`${line.product_id}-${line.product_variant_id}`}
                    line={line}
                  />
                ))
              : cartItems.map((item) => (
                  <FallbackCartLine
                    key={`${item.product.id}-${item.variant.id}`}
                    item={item}
                  />
                ))}
          </div>
        </section>

        {/* PWP upsell */}
        {preview && preview.pwp_suggestions.length > 0 && (
          <section>
            <PwpSuggestionBanner suggestions={preview.pwp_suggestions} onAdd={onPwpAdd} />
          </section>
        )}

        {/* Payment method */}
        <section>
          <PaymentMethodPicker
            methods={paymentMethods}
            selectedId={selectedPaymentMethodId}
            onSelect={(m) => setSelectedPaymentMethodId(m.id)}
            activePcs={activePcs}
          />

          {hasPcWithPaymentRestriction && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-blue-600">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              Một số sản phẩm có giá Flash Sale chỉ áp dụng với phương thức thanh toán cụ thể.
              Chọn đúng để hưởng ưu đãi.
            </p>
          )}
        </section>
      </div>

      {/* RIGHT: order summary + nút đặt hàng */}
      <div className="w-full lg:w-80 lg:sticky lg:top-4 flex flex-col gap-3">
        {preview ? (
          <CheckoutPromotionSummary preview={preview} shippingFee={shippingFee} />
        ) : (
          <FallbackOrderSummary cartItems={cartItems} shippingFee={shippingFee} />
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || selectedPaymentMethodId == null}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white',
            'bg-[#ee4d2d] transition-all hover:brightness-105 active:scale-[0.99]',
            'disabled:cursor-not-allowed disabled:bg-gray-300'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Đang xử lý…
            </>
          ) : (
            `Đặt hàng${selectedMethod ? ` qua ${selectedMethod.name}` : ''}`
          )}
        </button>

        <p className="text-center text-[11px] text-gray-400">
          Bằng cách đặt hàng, bạn đồng ý với điều khoản sử dụng của chúng tôi.
        </p>
      </div>
    </div>
  );
}

function FallbackCartLine({ item }: { item: CartItem }) {
  const price = item.variant.effectiveUnitPrice ?? item.variant.prices?.[0]?.currentValue ?? 0;
  const optionText = item.variant.optionValues
    ? Object.values(item.variant.optionValues).join(' / ')
    : null;
  return (
    <div className="flex items-start justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{item.product.productName}</p>
        {optionText && <p className="text-xs text-gray-500">{optionText}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-gray-400">x{item.quantity}</p>
        <p className="text-base font-bold text-gray-800">{formatPrice(price * item.quantity)}</p>
      </div>
    </div>
  );
}

function FallbackOrderSummary({
  cartItems,
  shippingFee,
}: {
  cartItems: CartItem[];
  shippingFee?: number | null;
}) {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant.effectiveUnitPrice ?? item.variant.prices?.[0]?.currentValue ?? 0;
    return sum + price * item.quantity;
  }, 0);
  const total = subtotal + (shippingFee ?? 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-bold text-gray-800">Tổng đơn hàng</p>
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Tạm tính</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {shippingFee != null && (
          <div className="flex justify-between">
            <span>Phí vận chuyển</span>
            <span>{shippingFee > 0 ? formatPrice(shippingFee) : 'Miễn phí'}</span>
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 pt-3 flex justify-between">
        <span className="text-sm font-semibold">Tổng cộng</span>
        <span className="text-xl font-bold text-[#ee4d2d]">{formatPrice(total)}</span>
      </div>
    </div>
  );
}

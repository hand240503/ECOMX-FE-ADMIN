import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { checkoutService } from '../api/services/checkoutService';
import type { CheckoutPricingPreviewRequest } from '../api/types/checkout.types';
import type { ProductVariantResponse, ProductPriceChange } from '../api/types/product.types';
import type { PaymentMethodDto } from '../api/types/order.types';
import {
  isPcVisibleOnCard,
  enrichPaymentMethodsWithPcBenefit,
} from '../lib/promotionUtils';

type CartLine = {
  productId: number;
  variant: ProductVariantResponse;
  quantity: number;
};

type UseCheckoutPricingOptions = {
  cartLines: CartLine[];
  paymentMethods: PaymentMethodDto[];
  enabled?: boolean;
};

export function useCheckoutPricing({
  cartLines,
  paymentMethods,
  enabled = true,
}: UseCheckoutPricingOptions) {
  const request: CheckoutPricingPreviewRequest = useMemo(
    () => ({
      lines: cartLines.map((l) => ({
        productId: l.productId,
        productVariantId: l.variant.id,
        quantity: l.quantity,
      })),
    }),
    [cartLines]
  );

  const {
    data: preview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['checkout-pricing-preview', request],
    queryFn: ({ signal }) => checkoutService.previewPricing(request, signal),
    enabled: enabled && cartLines.length > 0,
    staleTime: 30_000,
  });

  const allActivePcs = useMemo<ProductPriceChange[]>(() => {
    return cartLines
      .map((l) => l.variant.activePriceChange)
      .filter((pc): pc is ProductPriceChange => isPcVisibleOnCard(pc));
  }, [cartLines]);

  const enrichedMethods = useMemo(
    () => enrichPaymentMethodsWithPcBenefit(paymentMethods, allActivePcs),
    [paymentMethods, allActivePcs]
  );

  const pcRestrictedCodes = useMemo<Set<string>>(
    () =>
      new Set(
        allActivePcs
          .map((pc) => pc.requiredPaymentMethodCode?.trim().toUpperCase())
          .filter((c): c is string => !!c)
      ),
    [allActivePcs]
  );

  return {
    preview,
    isLoading,
    isError,
    error,
    refetch,
    allActivePcs,
    enrichedMethods,
    pcRestrictedCodes,
    hasPcWithPaymentRestriction: pcRestrictedCodes.size > 0,
  };
}

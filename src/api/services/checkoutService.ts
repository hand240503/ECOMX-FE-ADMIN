import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CheckoutPricingPreview, CheckoutPricingPreviewRequest } from '../types/checkout.types';

export const checkoutService = {
  async previewPricing(
    request: CheckoutPricingPreviewRequest,
    signal?: AbortSignal
  ): Promise<CheckoutPricingPreview> {
    const { data } = await axiosInstance.post<ApiResponse<CheckoutPricingPreview>>(
      API_ENDPOINTS.ORDER.PRICING_PREVIEW,
      request,
      { signal }
    );
    if (!data.success || data.data == null) {
      throw new Error(data.message || 'Không tải được thông tin giá');
    }
    return data.data;
  },
};

import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse, PaginationMetadata, ProductSearchMetadata } from '../types/common.types';
import type { ProductDetailResponse, ProductFullResponse } from '../types/product.types';

export interface ProductsByCategoryResult {
  products: ProductFullResponse[];
  metadata: PaginationMetadata | null;
  message: string;
}

export interface ProductSearchResult extends ProductsByCategoryResult {
  spellSuggestion: string | null;
}

export class ProductNotFoundError extends Error {
  readonly code = 'PRODUCT_NOT_FOUND' as const;
  constructor(message = 'Product not found') {
    super(message);
    this.name = 'ProductNotFoundError';
  }
}

const BY_IDS_MAX = 200;

/** Trần `limit` theo docs/FRONTEND_PRODUCT_FEATURED_HOT_SALE.md; backend hiện cần cả `limit` kèm `all=true` mới trả đủ danh sách. */
const FEATURED_HOT_SALE_MAX_LIMIT = 500;

function featuredHotQueryParams(all?: boolean): Record<string, boolean | number> {
  if (all === true) {
    return { all: true, limit: FEATURED_HOT_SALE_MAX_LIMIT };
  }
  return {};
}

/**
 * Một lần (`POST /products/by-ids`) với tối đa 200 id; nhiều hơn thì tự tách mảng.
 * Thứ tự phần tử theo từng lô, lần lượt nối kết quả từ server (theo từng lô theo tài liệu).
 * @see docs/API_products_by_ids_FE.md
 */
export async function getProductsByIds(
  productIds: number[],
  options?: { signal?: AbortSignal }
): Promise<ProductFullResponse[]> {
  const { signal } = options ?? {};
  if (productIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < productIds.length; i += BY_IDS_MAX) {
    chunks.push(productIds.slice(i, i + BY_IDS_MAX));
  }

  const all: ProductFullResponse[] = [];
  for (const chunk of chunks) {
    const { data } = await axiosInstance.post<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.PRODUCT.BY_IDS,
      { productIds: chunk },
      { signal }
    );

    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'getProductsByIds failed'
      );
    }

    const part = Array.isArray(data.data) ? data.data : [];
    all.push(...part);
  }
  return all;
}

export const productService = {
  /**
   * `POST /products/by-ids` — mảng `ProductFullResponse` theo thứ tự `productIds` (bỏ id không tồn tại).
   * @see docs/API_products_by_ids_FE.md
   */
  getByIds: getProductsByIds,

  /**
   * `GET /products/{id}/detail` — product + recommendations.
   * @see docs/product_api.md
   */
  async getDetail(params: {
    id: number | string;
    userId?: number;
    sessionId?: string;
    recommendationLimit?: number;
    signal?: AbortSignal;
  }): Promise<{ product: ProductFullResponse; recommendations: ProductFullResponse[] }> {
    const { id, userId, sessionId, recommendationLimit = 10, signal } = params;

    try {
      const { data } = await axiosInstance.get<ApiResponse<ProductDetailResponse>>(
        API_ENDPOINTS.PRODUCT.DETAIL_WITH_RECOMMENDATIONS(id),
        {
          params: {
            ...(userId != null ? { userId } : {}),
            ...(sessionId ? { sessionId } : {}),
            recommendationLimit,
          },
          signal,
        }
      );

      if (data.success === false || data.data?.product == null) {
        throw new ProductNotFoundError(
          typeof data.message === 'string' && data.message.trim() !== ''
            ? data.message.trim()
            : 'Product not found'
        );
      }

      return {
        product: data.data.product,
        recommendations: Array.isArray(data.data.recommendations) ? data.data.recommendations : [],
      };
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        throw new ProductNotFoundError();
      }
      throw e;
    }
  },

  /**
   * `GET /products/category/{categoryId}?page=&limit=`
   * — Trả SP gán vào `categoryId` hoặc bất kỳ danh mục con/cháu nào (subtree), phân trang, envelope `APIResponse`.
   * @see docs/product-by-category.md
   * @see docs/home-category-product-list-flow.md (bước 4 — `categoryId` là id số sau khi FE resolve từ URL)
   */
  async getByCategory(
    categoryId: number,
    params: { page?: number; limit?: number; signal?: AbortSignal }
  ): Promise<ProductsByCategoryResult> {
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.PRODUCT.BY_CATEGORY(categoryId),
      {
        params: {
          page: params.page ?? 0,
          limit: params.limit ?? 20,
        },
        signal: params.signal,
      }
    );

    return {
      products: Array.isArray(data.data) ? data.data : [],
      metadata: (data.metadata as PaginationMetadata | undefined) ?? null,
      message: typeof data.message === 'string' ? data.message : '',
    };
  },

  /**
   * `GET /products/search?q=&page=&limit=` — `APIResponse<ProductFullResponse[]>`; `metadata` phân trang + gợi ý từ khóa.
   * @see docs/api_search.md §1
   */
  async search(params: {
    q: string;
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<ProductSearchResult> {
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.PRODUCT.SEARCH,
      {
        params: {
          q: params.q,
          page: params.page ?? 0,
          limit: params.limit ?? 20,
        },
        signal: params.signal,
      }
    );

    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'Search failed'
      );
    }

    const meta = data.metadata as ProductSearchMetadata | undefined;
    const spellRaw = meta?.suggestedQuery ?? meta?.spellSuggestion;
    const spellSuggestion =
      typeof spellRaw === 'string' && spellRaw.trim() !== '' ? spellRaw.trim() : null;

    return {
      products: Array.isArray(data.data) ? data.data : [],
      metadata: meta ?? (data.metadata as PaginationMetadata | undefined) ?? null,
      message: typeof data.message === 'string' ? data.message : '',
      spellSuggestion,
    };
  },

  /**
   * `GET /products/is-featured?all=` — `all=true` trả toàn bộ; `all=false` (mặc định) hành vi mặc định backend (vd. giới hạn preview).
   * @see docs/FRONTEND_PRODUCT_FEATURED_HOT_SALE.md
   */
  async getIsFeatured(
    params?: { all?: boolean; signal?: AbortSignal }
  ): Promise<ProductFullResponse[]> {
    const { all = false, signal } = params ?? {};
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.PRODUCT.IS_FEATURED,
      { params: featuredHotQueryParams(all), signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'getIsFeatured failed'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },

  /**
   * `GET /products/hot-sale?all=` — cùng quy ước `all`.
   * @see docs/FRONTEND_PRODUCT_FEATURED_HOT_SALE.md
   */
  async getHotSale(
    params?: { all?: boolean; signal?: AbortSignal }
  ): Promise<ProductFullResponse[]> {
    const { all = false, signal } = params ?? {};
    const { data } = await axiosInstance.get<ApiResponse<ProductFullResponse[]>>(
      API_ENDPOINTS.PRODUCT.HOT_SALE,
      { params: featuredHotQueryParams(all), signal }
    );
    if (data.success === false) {
      throw new Error(
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : 'getHotSale failed'
      );
    }
    return Array.isArray(data.data) ? data.data : [];
  },
};

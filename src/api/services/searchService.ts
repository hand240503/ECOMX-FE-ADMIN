import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';

export interface TrendingKeyword {
  keyword: string;
  hot?: boolean;
}

/** Chuẩn hoá `data` từ `APIResponse` hoặc mảng chuỗi (tương thích sau này). Tối đa 12 mục — docs/api_search.md §2. */
function normalizeTrendingPayload(data: unknown): TrendingKeyword[] {
  if (!data || !Array.isArray(data)) return [];
  const out: TrendingKeyword[] = [];
  for (const item of data) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ keyword: item.trim() });
      continue;
    }
    if (item && typeof item === 'object' && 'keyword' in item) {
      const k = (item as { keyword?: unknown }).keyword;
      if (typeof k === 'string' && k.trim()) {
        const hotVal = (item as { hot?: unknown }).hot;
        const entry: TrendingKeyword = { keyword: k.trim() };
        if (hotVal === true) entry.hot = true;
        out.push(entry);
      }
    }
  }
  return out.slice(0, 12);
}

export const searchService = {
  /**
   * `GET /search/trending` — `APIResponse<TrendingKeyword[]>`.
   * @see docs/api_search.md §2
   */
  async getTrending(signal?: AbortSignal): Promise<TrendingKeyword[]> {
    const { data } = await axiosInstance.get<ApiResponse<TrendingKeyword[]>>(
      API_ENDPOINTS.SEARCH.TRENDING,
      { signal }
    );
    if (data.success === false) {
      return [];
    }
    return normalizeTrendingPayload(data.data);
  },
};

import { axiosInstance } from '../config/axiosConfig';

// ─── Types ────────────────────────────────────────────────────────────────

export interface InsightsSummary {
  cfCosinePairs: number;
  contentTfidfPairs: number;
  implicitRatings: number;
  implicitUsers: number;
  implicitProducts: number;
  userProfiles: number;
  cbRecommendations: number;
  activeProducts: number;
}

export interface SimilarityPair {
  sourceId: number;
  sourceName: string | null;
  targetId: number;
  targetName: string | null;
  similarity: number;
  rankPos: number;
  algorithm: string;
}

export interface ImplicitRating {
  userId: number;
  userName: string | null;
  productId: number;
  productName: string | null;
  rating: number;
}

export interface ProfileSignal {
  type: string;
  key: string;
  score: number | null;
}

export interface UserProfile {
  userId: number;
  userName: string | null;
  updatedAt: string | null;
  signals: ProfileSignal[];
}

export interface CbRecommendationItem {
  rank: number;
  productId: number;
  productName: string | null;
  similarity: number | null;
}

export interface CbRecommendation {
  userId: number;
  userName: string | null;
  topK: number;
  computedAt: string | null;
  items: CbRecommendationItem[];
}

export interface EventStat {
  event: string;
  count: number;
}

export interface PageMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface PagedResult<T> {
  content: T[];
  meta: PageMeta;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  metadata?: Partial<PageMeta> | null;
}

export type SimilarityAlgorithm = 'cf_cosine' | 'content_tfidf';

const BASE = '/admin/recommendation-insights';

function toMeta(m: Partial<PageMeta> | null | undefined, fallbackSize: number): PageMeta {
  return {
    page: m?.page ?? 0,
    size: m?.size ?? fallbackSize,
    total: m?.total ?? 0,
    totalPages: m?.totalPages ?? 0,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────

export const adminRecommendationInsightsService = {
  getSummary: async (): Promise<InsightsSummary> => {
    const res = await axiosInstance.get<ApiEnvelope<InsightsSummary>>(`${BASE}/summary`);
    return res.data.data;
  },

  getSimilarities: async (params: {
    algorithm?: SimilarityAlgorithm;
    source?: number | null;
    page?: number;
    size?: number;
  }): Promise<PagedResult<SimilarityPair>> => {
    const size = params.size ?? 50;
    const res = await axiosInstance.get<ApiEnvelope<SimilarityPair[]>>(`${BASE}/similarities`, {
      params: {
        algorithm: params.algorithm ?? 'cf_cosine',
        source: params.source ?? undefined,
        page: params.page ?? 0,
        size,
      },
    });
    return { content: res.data.data ?? [], meta: toMeta(res.data.metadata, size) };
  },

  getImplicitRatings: async (params: {
    userId?: number | null;
    productId?: number | null;
    page?: number;
    size?: number;
  }): Promise<PagedResult<ImplicitRating>> => {
    const size = params.size ?? 50;
    const res = await axiosInstance.get<ApiEnvelope<ImplicitRating[]>>(`${BASE}/implicit-ratings`, {
      params: {
        userId: params.userId ?? undefined,
        productId: params.productId ?? undefined,
        page: params.page ?? 0,
        size,
      },
    });
    return { content: res.data.data ?? [], meta: toMeta(res.data.metadata, size) };
  },

  getProfiles: async (params: {
    userId?: number | null;
    page?: number;
    size?: number;
  }): Promise<PagedResult<UserProfile>> => {
    const size = params.size ?? 20;
    const res = await axiosInstance.get<ApiEnvelope<UserProfile[]>>(`${BASE}/profiles`, {
      params: {
        userId: params.userId ?? undefined,
        page: params.page ?? 0,
        size,
      },
    });
    return { content: res.data.data ?? [], meta: toMeta(res.data.metadata, size) };
  },

  getCbRecommendations: async (params: {
    userId?: number | null;
    page?: number;
    size?: number;
  }): Promise<PagedResult<CbRecommendation>> => {
    const size = params.size ?? 20;
    const res = await axiosInstance.get<ApiEnvelope<CbRecommendation[]>>(`${BASE}/cb`, {
      params: {
        userId: params.userId ?? undefined,
        page: params.page ?? 0,
        size,
      },
    });
    return { content: res.data.data ?? [], meta: toMeta(res.data.metadata, size) };
  },

  /** Thống kê số lượt theo từng loại event trong collector_log (days = số ngày gần đây; 0 = tất cả). */
  getEventStats: async (days = 30): Promise<EventStat[]> => {
    const res = await axiosInstance.get<ApiEnvelope<EventStat[]>>(`${BASE}/event-stats`, {
      params: { days },
    });
    return res.data.data ?? [];
  },
};

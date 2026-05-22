export interface ErrorResponse {
  field?: string;
  code?: string;
  message: string;
  rejectedValue?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ErrorResponse[];
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface PaginationMetadata {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
  hasNext?: boolean;
  hasPrevious?: boolean;
  numberOfElements?: number;
}

/** `metadata` từ `GET /products/search` — docs/api_search.md */
export interface ProductSearchMetadata extends PaginationMetadata {
  suggestedQuery?: string;
  spellSuggestion?: string;
}

export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
}

export interface ApiFieldError {
  field?: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors: ApiFieldError[] | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

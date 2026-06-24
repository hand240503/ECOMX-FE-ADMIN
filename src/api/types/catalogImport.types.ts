/** Kết quả upsert một dòng — khớp CatalogImportRowResult (BE). */
export interface CatalogImportRowResult {
  rowNumber: number | null;
  key: string | null;
  /** CREATED | UPDATED | SKIPPED | FAILED */
  action: string | null;
  success: boolean;
  id: number | null;
  message: string | null;
}

/** Tổng hợp kết quả import/upsert — khớp CatalogImportResponse (BE). */
export interface CatalogImportResponse {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  /** Số dòng bỏ qua vì không thay đổi (giống hệt bản ghi hiện có). */
  skippedCount?: number;
  failureCount: number;
  results: CatalogImportRowResult[];
}

import { axiosInstance } from '../config/axiosConfig';
import type { ApiResponse } from '../types/common.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';

/** Gửi 1 file (multipart `file`) tới endpoint import, trả về CatalogImportResponse. */
export async function postImportFile(
  url: string,
  file: File,
  fallbackMsg: string,
  signal?: AbortSignal
): Promise<CatalogImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await axiosInstance.post<ApiResponse<CatalogImportResponse>>(url, fd, {
    signal,
    timeout: 120_000,
  });
  if (data.success === false || data.data == null) {
    const errMsg = data.errors?.[0]?.message ?? data.message;
    throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : fallbackMsg);
  }
  return data.data;
}

/** Tải file Excel mẫu (blob) từ endpoint template. */
export async function downloadTemplateBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await axiosInstance.get<Blob>(url, { responseType: 'blob', signal });
  return res.data;
}

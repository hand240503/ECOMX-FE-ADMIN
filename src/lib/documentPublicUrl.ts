import { API_BASE_URL } from '../api/config/axiosConfig';
import { API_ENDPOINTS } from '../api/config/apiEndpoints';
import type { AdminDocumentRecord } from '../api/types/product.types';

/**
 * Trích phần sau `/uploads/` để gọi `GET {prefix}/document/{filename}`.
 * `file_path` BE: `/uploads/{yyMMdd}/...`
 */
export function documentPathToApiFilename(filePath: string): string | null {
  const s = filePath.trim().replace(/\\/g, '/');
  if (!s || /^https?:\/\//i.test(s)) return null;
  const m = s.match(/^\/?uploads\/(.+)$/i);
  return m?.[1] ? m[1] : null;
}

/**
 * URL hiển thị / tải file local lưu trong bảng document (permitAll trên BE).
 */
export function publicDocumentFileUrl(filePath: string, baseUrl: string = API_BASE_URL): string | null {
  const trimmed = filePath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const filename = documentPathToApiFilename(trimmed);
  if (filename == null) return null;

  const encoded = filename
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  return `${baseUrl}${API_ENDPOINTS.DOCUMENT.BY_FILENAME(encoded)}`;
}

export function adminDocumentDisplayUrl(record: AdminDocumentRecord): string | null {
  const raw = record.filePath ?? record.file_path;
  return typeof raw === 'string' ? publicDocumentFileUrl(raw) : null;
}

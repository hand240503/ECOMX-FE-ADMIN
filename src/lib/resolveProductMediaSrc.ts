import { API_BASE_URL } from '../api/config/axiosConfig';
import { documentKindIsVideo } from './documentKind';

const ABSOLUTE_RX = /^https?:\/\//i;

/** Khớp `ProductDocumentSummary` từ BE (minimal cho pick first image). */
export interface ProductDocumentBrief {
  id?: number | null;
  filePath?: string | null;
  type?: number | null;
}

/** Chuẩn hóa `filePath`: bỏ dẫn `/`, bỏ tiền tố `uploads/` nếu có (khớp `GET …/document/{filename}`). */
function relativePathUnderUploadRoot(filePath: string): string {
  let rel = filePath.trim().replace(/^\/+/, '');
  if (rel.toLowerCase().startsWith('uploads/')) {
    rel = rel.slice('uploads/'.length);
  }
  return rel;
}

/**
 * Trả URL dùng cho `src` của `<img>` / `<video>`:
 * — URL tuyệt đối (Cloudinary…) → giữ nguyên;
 * — đường dẫn local kiểu `/uploads/...` → `${apiPrefix}/document/...`.
 *
 * `apiPrefix` mặc định `{API_BASE_URL}` (vd. `http://localhost:8080/api/v1`).
 */
export function resolveProductMediaSrc(
  filePath: string | null | undefined,
  apiPrefixOrBaseUrl: string = API_BASE_URL
): string | null {
  if (filePath == null) return null;
  const t = filePath.trim();
  if (!t) return null;
  if (ABSOLUTE_RX.test(t)) return t;

  const rel = relativePathUnderUploadRoot(t);
  if (!rel) return null;

  const prefix = apiPrefixOrBaseUrl.replace(/\/+$/, '');
  return `${prefix}/document/${rel}`;
}

/**
 * Fallback thứ tự: các trường ảnh trên SP → ảnh đầu tiên trong `documents` (không phải video).
 */
export function pickProductDisplaySrc(
  product: {
    thumbnailUrl?: string | null;
    mainImageUrl?: string | null;
    imageUrl?: string | null;
    coverImageUrl?: string | null;
    imageUrls?: string[] | null;
    documents?: ProductDocumentBrief[] | null;
  },
  apiPrefix?: string
): string | null {
  const prefixes = apiPrefix ?? API_BASE_URL;
  const tryList = [
    product.thumbnailUrl,
    product.mainImageUrl,
    product.imageUrl,
    product.coverImageUrl,
    ...(product.imageUrls ?? []),
  ];
  for (const c of tryList) {
    const u = resolveProductMediaSrc(c, prefixes);
    if (u) return u;
  }
  const docImg = product.documents
    ?.filter((d) => !documentKindIsVideo(d?.type ?? undefined, d?.filePath))
    ?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .find((d) => d.filePath?.trim());
  return resolveProductMediaSrc(docImg?.filePath ?? null, prefixes);
}

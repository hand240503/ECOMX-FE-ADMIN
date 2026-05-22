/**
 * Phân loại `document.type` theo BE DocumentKind:
 * `1` ảnh, `2` video, `3` tài liệu, `0` legacy (coi như ảnh trong gallery).
 *
 * Dữ liệu cũ có thể gửi video với `type === 1` (xem docs/FE_PRODUCT_IMAGES_RESPONSE.md);
 * khi đó nhận diện video qua đuôi file / Cloudinary `/video/`.
 */

import type { DocumentKind } from '../api/types/product.types';

export type { DocumentKind };

export function documentPathLooksLikeVideo(path: string): boolean {
  const p = path.trim().toLowerCase();
  if (/\.(mp4|webm|mov|m4v|mkv|ogg|ogv)(\?|#|$)/i.test(p)) return true;
  if (/cloudinary\.com\/.+\/video\//i.test(p)) return true;
  return false;
}

/** Video — ưu tiên `type === 2`; legacy: `type === 1` + đường dẫn giống video. */
export function documentKindIsVideo(
  type: number | null | undefined,
  filePath?: string | null
): boolean {
  if (type === 2) return true;
  if (type === 1 && filePath && documentPathLooksLikeVideo(filePath)) return true;
  return false;
}

/** Ảnh có thể làm cover / đưa vào gallery ảnh (không gồm tài liệu). */
export function documentKindCanBeCover(
  type: number | null | undefined,
  filePath?: string | null
): boolean {
  if (type === 3) return false;
  return !documentKindIsVideo(type, filePath);
}

/** `isMain` chỉ có nghiệp vụ cover khi là ảnh (type 1 hoặc legacy 0). */
export function documentIsMainCoverFlag(
  type: number | null | undefined,
  isMain: boolean | null | undefined,
  filePath?: string | null
): boolean {
  if (!isMain) return false;
  if (type === 0 || type === 1) return documentKindCanBeCover(type, filePath);
  return false;
}

export function firstImageFileIndex(files: File[]): number | undefined {
  const i = files.findIndex((f) => f.type.startsWith('image/'));
  return i >= 0 ? i : undefined;
}

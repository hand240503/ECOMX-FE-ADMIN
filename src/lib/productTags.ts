/** Chuỗi `tag` lưu DB — các thẻ cách nhau bằng dấu phẩy (vd. `"sale, audio"`). */

export function parseProductTagList(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Gửi BE / lưu DB — `", "` giữa các tag (đồng bộ ví dụ `{ "tag": "sale, audio" }`). */
export function serializeProductTags(tags: readonly string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(', ');
}

export function mergeUniqueProductTag(prev: readonly string[], raw: string): string[] {
  const t = raw.trim();
  if (!t) return [...prev];
  const lower = t.toLowerCase();
  if (prev.some((x) => x.trim().toLowerCase() === lower)) return [...prev];
  return [...prev, t];
}

/** Một lần nhập có thể dán `"sale, audio"` → thêm hai tag (không trùng, không phân biệt hoa thường). */
export function mergeUniqueTagsFromInput(prev: readonly string[], draft: string): string[] {
  let next = [...prev];
  for (const p of draft.split(',').map((s) => s.trim()).filter(Boolean)) {
    next = mergeUniqueProductTag(next, p);
  }
  return next;
}

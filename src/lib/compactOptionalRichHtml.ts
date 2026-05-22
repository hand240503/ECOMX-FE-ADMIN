/**
 * Gộp nội dung HTML “trống” (ví dụ `<p>&nbsp;</p>`) thành `undefined`
 * để không gửi field tùy chọn trong payload create/update.
 */
export function compactOptionalRichHtml(html: string): string | undefined {
  const t = html.trim();
  if (!t) return undefined;
  const textual = t
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!textual) return undefined;
  return t;
}

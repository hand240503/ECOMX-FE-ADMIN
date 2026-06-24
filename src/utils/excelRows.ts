import * as XLSX from 'xlsx';

/** Lưới dữ liệu đọc từ file import: tiêu đề + các dòng dữ liệu (đã ở dạng chuỗi). */
export type ParsedGrid = {
  /** Dòng tiêu đề (dòng đầu tiên của sheet). */
  headers: string[];
  /** Các dòng dữ liệu (không gồm tiêu đề). Mỗi dòng có độ rộng bằng số cột. */
  rows: string[][];
  /** Tên sheet đầu tiên (giữ lại khi dựng lại file). */
  sheetName: string;
};

const VALID_EXT = ['.xlsx', '.xls', '.csv', '.txt'];

/** Kiểm tra phần mở rộng file có được hỗ trợ không. */
export function isValidImportFile(name: string): boolean {
  const lower = name.toLowerCase();
  return VALID_EXT.some((ext) => lower.endsWith(ext));
}

function cellToStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = await file.text();
    return XLSX.read(text, { type: 'string', raw: false });
  }
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

/**
 * Đọc file Excel/CSV/TXT thành lưới {headers, rows}.
 * Dùng `raw:false` để lấy đúng chuỗi hiển thị (số có dấu phân tách, ngày tháng…) —
 * khớp với cách backend phân tích dữ liệu dạng văn bản.
 */
export async function parseImportFile(file: File): Promise<ParsedGrid> {
  const wb = await readWorkbook(file);
  const sheetName = wb.SheetNames[0] ?? '';
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { headers: [], rows: [], sheetName };

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  const matrix: string[][] = aoa.map((r) => (Array.isArray(r) ? r.map(cellToStr) : []));
  if (matrix.length === 0) return { headers: [], rows: [], sheetName };

  const width = Math.max(matrix[0].length, ...matrix.map((r) => r.length));
  const pad = (r: string[]): string[] => {
    const a = r.slice();
    while (a.length < width) a.push('');
    return a;
  };

  const headers = pad(matrix[0]);
  const rows = matrix
    .slice(1)
    .map(pad)
    .filter((r) => r.some((c) => c.trim() !== ''));

  return { headers, rows, sheetName };
}

/**
 * Dựng lại file .xlsx chỉ gồm dòng tiêu đề + các dòng được chọn (theo chỉ số trong `grid.rows`).
 * Trả về File mới (luôn ở định dạng .xlsx) để gửi tới endpoint import hiện có.
 */
export function rebuildFilteredFile(
  grid: ParsedGrid,
  selectedIndexes: Set<number>,
  fileName: string
): File {
  const selected = grid.rows.filter((_, i) => selectedIndexes.has(i));
  const aoa: string[][] = [grid.headers, ...selected];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, grid.sheetName || 'Sheet1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const base = fileName.replace(/\.(xlsx|xls|csv|txt)$/i, '') || 'import';
  return new File([out], `${base}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

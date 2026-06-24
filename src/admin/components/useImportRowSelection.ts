import { useCallback, useMemo, useState } from 'react';
import { parseImportFile, rebuildFilteredFile, type ParsedGrid } from '../../utils/excelRows';

const EMPTY_GRID: ParsedGrid = { headers: [], rows: [], sheetName: '' };

/**
 * Hook quản lý việc đọc file Excel/CSV thành lưới + trạng thái chọn dòng.
 * Mặc định CHỌN TẤT CẢ sau khi phân tích. Cung cấp helper dựng lại file đã lọc.
 */
export function useImportRowSelection() {
  const [grid, setGrid] = useState<ParsedGrid>(EMPTY_GRID);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  /** Phân tích file và mặc định chọn tất cả các dòng. */
  const parse = useCallback(async (file: File): Promise<ParsedGrid> => {
    const g = await parseImportFile(file);
    setGrid(g);
    setSelected(new Set(g.rows.map((_, i) => i)));
    return g;
  }, []);

  const reset = useCallback(() => {
    setGrid(EMPTY_GRID);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(grid.rows.map((_, i) => i)));
  }, [grid.rows]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  /** Dựng lại file .xlsx chỉ gồm các dòng đang được chọn. */
  const buildFile = useCallback(
    (fileName: string): File => rebuildFilteredFile(grid, selected, fileName),
    [grid, selected]
  );

  const selectedCount = selected.size;
  const totalCount = grid.rows.length;
  const hasSelection = useMemo(() => selectedCount > 0, [selectedCount]);

  return {
    grid,
    selected,
    selectedCount,
    totalCount,
    hasSelection,
    parse,
    reset,
    toggle,
    selectAll,
    clearAll,
    buildFile,
  };
}

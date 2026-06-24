import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Download, Plus, Search, Upload, X } from 'lucide-react';
import { adminProductService } from '../../api/services/adminProductService';
import { categoryService } from '../../api/services/categoryService';
import { flattenCategories } from '../../lib/categoryCatalog';
import { AdminProductsDataTable } from '../components/AdminProductsDataTable';
import { AdminProductImportModal } from '../components/AdminProductImportModal';

export default function AdminProductsPage() {
  // ── URL params — page đồng bộ với ?page=N (1-based trong URL, 0-based nội bộ) ──
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(0, (parseInt(searchParams.get('page') ?? '1', 10) || 1) - 1);

  const setPage = useCallback(
    (p: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (p === 0) {
            next.delete('page');
          } else {
            next.set('page', String(p + 1));
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [limit, setLimit] = useState(10);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await adminProductService.exportProducts();
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `san_pham_export_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }, []);

  const [exportingIncomplete, setExportingIncomplete] = useState(false);
  const handleExportIncomplete = useCallback(async () => {
    setExportingIncomplete(true);
    try {
      const blob = await adminProductService.exportIncompleteProducts();
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `san_pham_chua_hoan_thien_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Xuất sản phẩm chưa hoàn thiện thất bại');
    } finally {
      setExportingIncomplete(false);
    }
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim()), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  // Reset page khi thay đổi filter — bỏ qua lần mount đầu để giữ ?page=N từ URL
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    setPage(0);
  }, [search, categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchMode = search !== '';

  // ── Data ─────────────────────────────────────────────────────────────────
  const categoriesQuery = useQuery({
    queryKey: ['admin-categories-flat'],
    queryFn: () => categoryService.getAll(),
    staleTime: 5 * 60_000,
  });

  const flatCats = useMemo(
    () => flattenCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );

  // Query phân trang bình thường
  const listQuery = useQuery({
    queryKey: ['admin-products', page, limit, categoryId === '' ? null : categoryId],
    queryFn: async ({ signal }) => {
      if (categoryId === '') {
        return adminProductService.list({ page, limit, signal });
      }
      return adminProductService.listByCategory(categoryId, { page, limit, signal });
    },
    enabled: !searchMode,
  });

  // Query load-all khi search (tối đa 1000)
  const searchAllQuery = useQuery({
    queryKey: ['admin-products-search-all', categoryId === '' ? null : categoryId],
    queryFn: async ({ signal }) => {
      if (categoryId === '') {
        return adminProductService.list({ page: 0, limit: 1000, signal });
      }
      return adminProductService.listByCategory(categoryId, { page: 0, limit: 1000, signal });
    },
    enabled: searchMode,
    staleTime: 60_000,
  });

  // Lọc client-side khi search
  const filteredProducts = useMemo(() => {
    if (!searchMode) return listQuery.data?.products ?? [];
    const q = search.toLowerCase();
    return (searchAllQuery.data?.products ?? []).filter((p) =>
      String(p.id).includes(q) ||
      p.productName.toLowerCase().includes(q) ||
      (p.sku != null && String(p.sku).toLowerCase().includes(q))
    );
  }, [searchMode, listQuery.data, searchAllQuery.data, search]);

  // Pagination chỉ dùng khi không search
  const meta = listQuery.data?.metadata;

  const pagination =
    !searchMode && meta != null
      ? {
          currentPage: meta.page ?? page,
          totalPages: meta.totalPages ?? 1,
          totalElements: meta.totalElements ?? 0,
          pageSize: limit,
          onPageChange: (p: number) => setPage(p),
        }
      : undefined;

  const isLoading = searchMode ? searchAllQuery.isLoading : listQuery.isLoading;
  const queryError = searchMode
    ? (searchAllQuery.isError ? (searchAllQuery.error instanceof Error ? searchAllQuery.error : new Error('Unknown')) : null)
    : (listQuery.isError ? (listQuery.error instanceof Error ? listQuery.error : new Error('Unknown')) : null);

  const inputCls = clsx(
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
            Sản phẩm
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold',
              'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <Download className="size-4" aria-hidden />
            {exporting ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
          <button
            type="button"
            onClick={() => void handleExportIncomplete()}
            disabled={exportingIncomplete}
            title="Sản phẩm chưa có biến thể hoặc chưa có giá"
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold',
              'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <Download className="size-4" aria-hidden />
            {exportingIncomplete ? 'Đang xuất…' : 'Xuất SP chưa hoàn thiện'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold',
              'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <Upload className="size-4" aria-hidden />
            Tải sản phẩm lên
          </button>
          <Link
            to="/admin/products/create"
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white',
              'bg-[var(--accent)] hover:brightness-110',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <Plus className="size-4" aria-hidden />
            Tạo sản phẩm
          </Link>
        </div>
      </div>

      <AdminProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-products-search-all'] });
        }}
      />

      {/* Filter card */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end">

        {/* Search */}
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
          Tìm kiếm
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="ID, tên sản phẩm hoặc SKU…"
              className={clsx(inputCls, 'w-full pl-9 pr-9')}
              aria-label="Tìm kiếm sản phẩm theo ID, tên hoặc SKU"
            />
            {searchRaw && (
              <button
                type="button"
                onClick={() => { setSearchRaw(''); searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </label>

        {/* Danh mục */}
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
          Danh mục
          <select
            value={categoryId === '' ? '' : String(categoryId)}
            onChange={(e) => {
              const v = e.target.value;
              setCategoryId(v === '' ? '' : Number(v));
              // setPage(0) sẽ tự chạy qua useEffect [search, categoryId]
            }}
            className={inputCls}
          >
            <option value="">Tất cả</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (#{c.id})
              </option>
            ))}
          </select>
        </label>

        {/* Số dòng / trang — ẩn khi đang search */}
        {!searchMode && (
          <label className="flex w-full flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)] sm:w-36">
            Số dòng / trang
            <select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value) || 10);
                setPage(0);
              }}
              className={inputCls}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Kết quả search */}
      {searchMode && !isLoading && (
        <p className="text-xs text-[var(--text-muted)]">
          {filteredProducts.length > 0
            ? `Tìm thấy ${filteredProducts.length} sản phẩm cho "${search}"`
            : `Không có sản phẩm nào khớp với "${search}"`}
        </p>
      )}

      <AdminProductsDataTable
        products={filteredProducts}
        isLoading={isLoading}
        error={queryError}
        pagination={pagination}
      />
    </div>
  );
}

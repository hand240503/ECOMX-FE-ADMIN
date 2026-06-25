import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Plus, UploadCloud } from 'lucide-react';
import { productService } from '../../api/services/productService';
import { adminProductService } from '../../api/services/adminProductService';
import { AdminProductsDataTable } from '../components/AdminProductsDataTable';
import { AdminBulkImportModal } from '../components/AdminBulkImportModal';

export type AdminProductsCuratedKind = 'featured' | 'hot-sale';

const COPY: Record<
  AdminProductsCuratedKind,
  { title: string; querySuffix: string; importTitle: string; importSubtitle: string; templateFile: string }
> = {
  featured: {
    title: 'Sản phẩm nổi bật',
    querySuffix: 'featured',
    importTitle: 'Đánh dấu sản phẩm nổi bật từ Excel',
    importSubtitle:
      'Mỗi dòng một sản phẩm (theo sku hoặc product_id). Cột value: TRUE/1/Có = bật cờ nổi bật, FALSE/0/Không = gỡ cờ, để trống = mặc định bật.',
    templateFile: 'mau_import_noi_bat.xlsx',
  },
  'hot-sale': {
    title: 'Bán chạy',
    querySuffix: 'hot-sale',
    importTitle: 'Đánh dấu sản phẩm hot-sale từ Excel',
    importSubtitle:
      'Mỗi dòng một sản phẩm (theo sku hoặc product_id). Cột value: TRUE/1/Có = bật cờ hot-sale, FALSE/0/Không = gỡ cờ, để trống = mặc định bật.',
    templateFile: 'mau_import_hot_sale.xlsx',
  },
};

export default function AdminProductsCuratedPage({ kind }: { kind: AdminProductsCuratedKind }) {
  const { title, querySuffix, importTitle, importSubtitle, templateFile } = COPY[kind];
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [importOpen, setImportOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ['admin-products-curated', querySuffix],
    queryFn: async ({ signal }) =>
      kind === 'featured'
        ? productService.getIsFeatured({ all: true, signal })
        : productService.getHotSale({ all: true, signal }),
  });

  const all = listQuery.data ?? [];
  const totalElements = all.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / limit) || 1);
  const slice = useMemo(() => all.slice(page * limit, page * limit + limit), [all, page, limit]);

  const pagination =
    totalElements > 0
      ? {
          currentPage: page,
          totalPages,
          totalElements,
          pageSize: limit,
          onPageChange: (p: number) => setPage(p),
        }
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
            {title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]',
              'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <UploadCloud className="size-4" aria-hidden />
            Import Excel
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

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex w-full flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)] sm:w-36">
          Số dòng / trang
          <select
            value={String(limit)}
            onChange={(e) => {
              setPage(0);
              setLimit(Number(e.target.value) || 10);
            }}
            className={clsx(
              'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AdminProductsDataTable
        products={slice}
        isLoading={listQuery.isLoading}
        error={listQuery.isError ? (listQuery.error instanceof Error ? listQuery.error : new Error('Unknown')) : null}
        pagination={pagination}
      />

      <AdminBulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={importTitle}
        subtitle={importSubtitle}
        importFn={(file) =>
          kind === 'featured' ? adminProductService.importFeatured(file) : adminProductService.importHotSale(file)
        }
        templateFn={() =>
          kind === 'featured'
            ? adminProductService.downloadFeaturedTemplate()
            : adminProductService.downloadHotSaleTemplate()
        }
        templateFileName={templateFile}
        createdLabel="Đã đánh dấu"
        updatedLabel="Đã gỡ"
        onImported={() => void listQuery.refetch()}
      />
    </div>
  );
}

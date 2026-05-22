import { Link } from 'react-router-dom';

import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { clsx } from 'clsx';

import { Plus } from 'lucide-react';

import { productService } from '../../api/services/productService';

import { AdminProductsDataTable } from '../components/AdminProductsDataTable';



export type AdminProductsCuratedKind = 'featured' | 'hot-sale';



const COPY: Record<AdminProductsCuratedKind, { title: string; querySuffix: string }> = {

  featured: {

    title: 'Sản phẩm nổi bật',

    querySuffix: 'featured',

  },

  'hot-sale': {

    title: 'Hot-sale',

    querySuffix: 'hot-sale',

  },

};



export default function AdminProductsCuratedPage({ kind }: { kind: AdminProductsCuratedKind }) {

  const { title, querySuffix } = COPY[kind];

  const [page, setPage] = useState(0);

  const [limit, setLimit] = useState(10);



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



  const canPrev = page > 0;

  const canNext = page + 1 < totalPages;



  const pagination =

    totalElements > 0

      ? {

          canPrev,

          canNext,

          summary: `Trang ${page + 1}/${totalPages} · ${slice.length} kết quả · tổng ${totalElements}`,

          onPrev: () => setPage((p) => Math.max(0, p - 1)),

          onNext: () => setPage((p) => (p + 1 < totalPages ? p + 1 : p)),

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

    </div>

  );

}


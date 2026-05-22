import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { ProductFullResponse } from '../../api/types/product.types';
import { formatProductListPriceLabel } from '../../lib/formatPrice';
import { pickProductDisplaySrc } from '../../lib/resolveProductMediaSrc';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

function productStatusLabel(status: number): string {
  if (status === 1) return 'Đang bán';
  if (status === 0) return 'Ngừng bán';
  return String(status);
}

export type AdminProductsDataTableProps = {
  products: ProductFullResponse[];
  isLoading: boolean;
  error: Error | null;
  /** Pagination footer — phân trang offset/limit dạng số */
  pagination?: {
    /** Trang hiện tại (0-based) */
    currentPage: number;
    /** Tổng số trang */
    totalPages: number;
    /** Tổng số phần tử */
    totalElements: number;
    /** Số dòng / trang */
    pageSize: number;
    onPageChange: (page: number) => void;
  };
};

/** Tính danh sách số trang + dấu '...' cần hiển thị (0-based) */
function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 1) return [0];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: (number | '...')[] = [];
  const left = Math.max(0, current - 2);
  const right = Math.min(total - 1, current + 2);

  if (left > 0) {
    pages.push(0);
    if (left > 1) pages.push('...');
  }
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) {
    if (right < total - 2) pages.push('...');
    pages.push(total - 1);
  }

  return pages;
}

export function AdminProductsDataTable({
  products,
  isLoading,
  error,
  pagination,
}: AdminProductsDataTableProps) {
  const navigate = useNavigate();

  const goEdit = (productId: number) => {
    navigate(`/admin/products/${productId}/edit`);
  };

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)]',
        'shadow-[var(--card-shadow)]'
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-secondary)]">
          <Spinner className="text-[var(--accent)]" />
          Đang tải…
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-[var(--danger)]">{getApiErrorMessage(error, 'Không tải được danh sách.')}</div>
      ) : (
        <div className="overflow-x-auto">
          <p className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-4 py-2 text-[11px] leading-snug text-[var(--text-muted)]">
            Double-click một dòng để mở trang chỉnh sửa. Để gỡ khỏi cửa hàng, chọn{' '}
            <span className="font-semibold text-[var(--text-secondary)]">Ngừng bán</span> trong form sản phẩm — không xóa sản phẩm
            khỏi hệ thống.
          </p>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]">
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">ID</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">SKU</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--text-secondary)]">Ảnh</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">Tên</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">Danh mục</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">Giá</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-secondary)]">Đã bán</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    Không có sản phẩm trên trang này.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    title="Double-click để chỉnh sửa (Enter khi đang focus dòng)"
                    aria-label={`${p.productName}: double-click hoặc Enter để chỉnh sửa`}
                    className={clsx(
                      'cursor-pointer border-b border-[var(--bg-border)]/80 outline-none select-none',
                      'hover:bg-[var(--bg-elevated)]/40',
                      'focus-visible:bg-[var(--bg-elevated)]/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]'
                    )}
                    onDoubleClick={() => goEdit(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goEdit(p.id);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{p.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {p.sku == null ? '—' : p.sku}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]">
                        {(() => {
                          const src = pickProductDisplaySrc(p);
                          return src ? (
                            <img
                              src={src}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                              draggable={false}
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                el.removeAttribute('src');
                              }}
                            />
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]">—</span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[220px]">
                        <span className="line-clamp-2 font-medium text-[var(--text-primary)]">{p.productName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {p.category?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-primary)]">{formatProductListPriceLabel(p)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {productStatusLabel(p.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{p.soldCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination && !isLoading && !error ? (
        <div className="flex flex-col gap-3 border-t border-[var(--bg-border)] px-4 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          {/* Tóm tắt */}
          <span>
            Trang {pagination.currentPage + 1}/{Math.max(1, pagination.totalPages)} · tổng{' '}
            {pagination.totalElements.toLocaleString('vi-VN')} sản phẩm
          </span>

          {/* Thanh số trang */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              {/* Nút Trước */}
              <button
                type="button"
                disabled={pagination.currentPage === 0}
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                className={clsx(
                  'rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 font-semibold text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                )}
                aria-label="Trang trước"
              >
                ‹
              </button>

              {/* Số trang */}
              {buildPageNumbers(pagination.currentPage, pagination.totalPages).map((item, idx) =>
                item === '...' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-[var(--text-muted)] select-none"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => pagination.onPageChange(item)}
                    aria-label={`Trang ${item + 1}`}
                    aria-current={item === pagination.currentPage ? 'page' : undefined}
                    className={clsx(
                      'min-w-[2rem] rounded-lg border px-2 py-1.5 text-center font-semibold',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                      item === pagination.currentPage
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--bg-border)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    )}
                  >
                    {item + 1}
                  </button>
                )
              )}

              {/* Nút Sau */}
              <button
                type="button"
                disabled={pagination.currentPage >= pagination.totalPages - 1}
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                className={clsx(
                  'rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 font-semibold text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                )}
                aria-label="Trang sau"
              >
                ›
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

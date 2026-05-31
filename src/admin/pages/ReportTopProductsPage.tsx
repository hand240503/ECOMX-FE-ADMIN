import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reportService } from '../../api/services/reportService';
import type { TopProductReportDto } from '../../api/services/reportService';
import {
  TrendingUp, Eye, ArrowLeft, ChevronLeft, ChevronRight,
  Activity, ShoppingBag, Package, AlertCircle, Loader2, Calendar
} from 'lucide-react';

const TIME_RANGES = [
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm nay' },
  { value: 'all', label: 'Toàn thời gian' },
];

const PAGE_SIZE = 20;

export default function ReportTopProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = (searchParams.get('type') ?? 'selling') as 'selling' | 'interested';
  const timeRange = searchParams.get('timeRange') ?? 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const [data, setData] = useState<TopProductReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSelling = type === 'selling';
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fetchData = useCallback(async (range: string, kind: 'selling' | 'interested') => {
    try {
      setLoading(true);
      setError(null);
      const res = kind === 'selling'
        ? await reportService.getTopSelling(range, 500)
        : await reportService.getTopInterested(range, 500);
      if (res.success) setData(res.data ?? []);
      else setError('Không thể tải dữ liệu.');
    } catch {
      setError('Đã xảy ra lỗi khi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(timeRange, type);
  }, [timeRange, type, fetchData]);

  const setParam = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      if (key !== 'page') next.set('page', '1');
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
            {isSelling
              ? <TrendingUp className="size-5 text-emerald-500" />
              : <Eye className="size-5 text-blue-500" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {isSelling ? 'Sản Phẩm Bán Chạy Nhất' : 'Sản Phẩm Được Quan Tâm'}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {data.length > 0 ? `${data.length} sản phẩm` : 'Đang tải...'}
            </p>
          </div>
        </div>

        {/* Tab type + time range */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-1">
            <button
              onClick={() => setParam('type', 'selling')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                isSelling
                  ? 'bg-emerald-500 text-white shadow'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <ShoppingBag className="size-3.5" />
              Bán chạy
            </button>
            <button
              onClick={() => setParam('type', 'interested')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                !isSelling
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Eye className="size-3.5" />
              Quan tâm
            </button>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-1">
            {TIME_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setParam('timeRange', r.value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  timeRange === r.value
                    ? 'bg-[var(--accent)] text-white shadow'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Calendar className="size-3" />
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex flex-1 flex-col rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-base)] shadow-sm">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--text-muted)]">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
            <Package className="size-12 text-[var(--text-muted)] opacity-40" />
            <p className="text-sm font-medium text-[var(--text-muted)]">Không có dữ liệu</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/50">
                    <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">#</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sản phẩm</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">SKU</th>
                    <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {isSelling ? 'Đã bán' : 'Điểm quan tâm'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--bg-border)]">
                  {pageData.map((item, i) => {
                    const rank = (page - 1) * PAGE_SIZE + i + 1;
                    return (
                      <tr key={item.productId} className="group transition-colors hover:bg-[var(--bg-elevated)]/40">
                        <td className="px-6 py-3.5">
                          <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                            rank === 1 ? 'bg-yellow-400/20 text-yellow-600' :
                            rank === 2 ? 'bg-slate-400/20 text-slate-500' :
                            rank === 3 ? 'bg-orange-400/20 text-orange-600' :
                            'bg-[var(--bg-border)] text-[var(--text-muted)]'
                          }`}>
                            {rank}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                            {item.productName}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-[var(--text-muted)]">
                          {item.sku || '—'}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            isSelling
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-blue-500/10 text-blue-600'
                          }`}>
                            {isSelling
                              ? <ShoppingBag className="size-3" />
                              : <Activity className="size-3" />}
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--bg-border)] px-6 py-4">
                <p className="text-sm text-[var(--text-muted)]">
                  Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.length)} / {data.length} sản phẩm
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setParam('page', String(page - 1))}
                    disabled={page === 1}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-[var(--text-muted)]">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setParam('page', String(p))}
                          className={`flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            p === page
                              ? 'bg-[var(--accent)] text-white'
                              : 'border border-[var(--bg-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setParam('page', String(page + 1))}
                    disabled={page === totalPages}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

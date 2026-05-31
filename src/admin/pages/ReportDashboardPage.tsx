import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../api/services/reportService';
import type { TopProductReportDto } from '../../api/services/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  TrendingUp, Activity, BarChart2, Calendar, ShoppingBag,
  Eye, Package, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';

const TIME_RANGES = [
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm nay' },
  { value: 'all', label: 'Toàn thời gian' }
];

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6'];

export default function ReportDashboardPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<string>('all');
  const [topSelling, setTopSelling] = useState<TopProductReportDto[]>([]);
  const [topInterested, setTopInterested] = useState<TopProductReportDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const fetchData = async (range: string) => {
    try {
      setLoading(true);
      setError(null);
      const [sellingRes, interestedRes] = await Promise.all([
        reportService.getTopSelling(range, 10),
        reportService.getTopInterested(range, 10),
      ]);
      if (sellingRes.success) setTopSelling(sellingRes.data || []);
      if (interestedRes.success) setTopInterested(interestedRes.data || []);
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      setError('Đã xảy ra lỗi khi tải dữ liệu báo cáo.');
    } finally {
      setLoading(false);
    }
  };

  const goToAll = (type: 'selling' | 'interested') => {
    navigate(`/admin/reports/top-products?type=${type}&timeRange=${timeRange}`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/95 p-4 shadow-xl backdrop-blur-md">
          <p className="mb-2 font-bold text-[var(--text-primary)]">{payload[0].payload.productName}</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--text-muted)]">SKU:</span>
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              {payload[0].payload.sku || 'N/A'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[13px] text-[var(--text-muted)]">Số lượng:</span>
            <span className="text-sm font-bold text-[var(--accent)]">
              {payload[0].value}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            <BarChart2 className="size-6 text-[var(--accent)]" />
            Báo Cáo & Thống Kê
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Theo dõi hiệu suất bán hàng và mức độ quan tâm của khách hàng.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-base)] p-1.5 shadow-sm">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                timeRange === range.value
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {range.value === 'all' && <Activity className="size-4" />}
              {range.value !== 'all' && <Calendar className="size-4" />}
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">Đang tải dữ liệu báo cáo...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Selling Products */}
          <div className="flex flex-col rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-base)] shadow-sm">
            <div className="border-b border-[var(--bg-border)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="size-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">Sản Phẩm Bán Chạy Nhất</h2>
                  <p className="text-[13px] text-[var(--text-muted)]">Top 10 sản phẩm có doanh số cao nhất</p>
                </div>
              </div>
            </div>
            
            <div className="p-5">
              {topSelling.length > 0 ? (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSelling} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--bg-border)" />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="productName" 
                        type="category" 
                        width={120} 
                        tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                        stroke="var(--text-secondary)" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
                        {topSelling.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--bg-border)]">
                  <Package className="size-10 text-[var(--text-muted)] opacity-50" />
                  <p className="text-sm font-medium text-[var(--text-muted)]">Chưa có dữ liệu bán hàng</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-[var(--bg-border)] p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="pb-3 pr-4 font-semibold">Sản phẩm</th>
                      <th className="pb-3 px-4 font-semibold text-center">Đã bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bg-border)]">
                    {topSelling.slice(0, 5).map((item, i) => (
                      <tr key={item.productId} className="group transition-colors hover:bg-[var(--bg-elevated)]/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-border)] text-xs font-bold text-[var(--text-secondary)]">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{item.productName}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{item.sku || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                            <ShoppingBag className="size-3" />
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => goToAll('selling')}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--bg-border)] py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <ArrowRight className="size-3.5" />
                Xem tất cả
              </button>
            </div>
          </div>

          {/* Top Interested Products */}
          <div className="flex flex-col rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-base)] shadow-sm">
            <div className="border-b border-[var(--bg-border)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Eye className="size-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">Sản Phẩm Được Quan Tâm</h2>
                  <p className="text-[13px] text-[var(--text-muted)]">Top 10 sản phẩm có lượt xem/lượt thêm giỏ cao</p>
                </div>
              </div>
            </div>
            
            <div className="p-5">
              {topInterested.length > 0 ? (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topInterested} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--bg-border)" />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="productName" 
                        type="category" 
                        width={120} 
                        tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                        stroke="var(--text-secondary)" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
                        {topInterested.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--bg-border)]">
                  <Package className="size-10 text-[var(--text-muted)] opacity-50" />
                  <p className="text-sm font-medium text-[var(--text-muted)]">Chưa có dữ liệu quan tâm</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-[var(--bg-border)] p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="pb-3 pr-4 font-semibold">Sản phẩm</th>
                      <th className="pb-3 px-4 font-semibold text-center">Điểm quan tâm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bg-border)]">
                    {topInterested.slice(0, 5).map((item, i) => (
                      <tr key={item.productId} className="group transition-colors hover:bg-[var(--bg-elevated)]/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-border)] text-xs font-bold text-[var(--text-secondary)]">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{item.productName}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">{item.sku || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                            <Activity className="size-3" />
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => goToAll('interested')}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--bg-border)] py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <ArrowRight className="size-3.5" />
                Xem tất cả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

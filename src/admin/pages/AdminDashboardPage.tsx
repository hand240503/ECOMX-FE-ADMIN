import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { format, subDays, startOfDay, isAfter, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  Shield,
  Tag,
  ArrowRight,
  FolderTree,
  Award,
  BarChart2,
  Loader2,
  Activity,
  Edit3,
  Plus,
  CheckCircle2,
  UserPlus,
  RotateCcw,
  Trash2,
  Clock,
  CircleDollarSign,
  Warehouse,
  History,
  Settings,
  FileStack,
  ClipboardList,
} from 'lucide-react';
import { adminOrderService } from '../../api/services/adminOrderService';
import { adminProductService } from '../../api/services/adminProductService';
import {
  adminStaffService,
  adminCustomerService,
} from '../../api/services/adminStaffEmployeeService';
import { adminPromotionService } from '../../api/services/adminPromotionService';
import { adminHistoryService } from '../../api/services/adminHistoryService';
import { adminBrandService } from '../../api/services/adminBrandService';
import { adminCategoryService } from '../../api/services/adminCategoryService';
import { formatPrice } from '../../lib/formatPrice';
import type { OrderDto } from '../../api/types/order.types';
import type { UnifiedHistoryResponse } from '../../api/types/history.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtRevenue(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B ₫`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.trunc(n).toLocaleString('vi-VN');
}

type DayRange = 7 | 30 | 90;

function buildRevenueData(orders: OrderDto[], days: DayRange) {
  const now = new Date();
  const cutoff = startOfDay(subDays(now, days - 1));
  const map = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    const key = format(subDays(now, i), 'dd/MM');
    map.set(key, 0);
  }

  for (const o of orders) {
    if (o.status !== 4) continue;
    if (!o.createdDate) continue;
    const d = parseISO(o.createdDate);
    if (!isAfter(d, cutoff) && format(d, 'dd/MM') !== format(cutoff, 'dd/MM')) continue;
    const key = format(d, 'dd/MM');
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + (o.total ?? 0));
  }

  return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
}

const STATUS_CONFIG: Record<
  number,
  { label: string; color: string; bg: string; text: string }
> = {
  1: { label: 'Chờ chuẩn bị', color: '#F59E0B', bg: 'bg-amber-100', text: 'text-amber-800' },
  2: { label: 'Chờ vận chuyển', color: '#3B82F6', bg: 'bg-blue-100', text: 'text-blue-800' },
  3: { label: 'Đang giao', color: '#8B5CF6', bg: 'bg-violet-100', text: 'text-violet-800' },
  4: { label: 'Hoàn thành', color: '#22C55E', bg: 'bg-green-100', text: 'text-green-800' },
  5: { label: 'Đã hủy', color: '#EF4444', bg: 'bg-red-100', text: 'text-red-800' },
};

function historyIcon(h: UnifiedHistoryResponse) {
  const a = h.action;
  if (a === 'CREATE') return <Plus className="size-3.5" />;
  if (a === 'UPDATE') return <Edit3 className="size-3.5" />;
  if (a === 'DELETE') return <Trash2 className="size-3.5" />;
  if (a === 'ORDER_STATUS') return <RotateCcw className="size-3.5" />;
  if (a === 'RETURN_REFUND_STATUS') return <RotateCcw className="size-3.5" />;
  return <Activity className="size-3.5" />;
}

function historyColor(h: UnifiedHistoryResponse) {
  const a = h.action;
  if (a === 'CREATE') return 'bg-[var(--success)]/15 text-[var(--success)]';
  if (a === 'UPDATE') return 'bg-[var(--warning)]/15 text-[var(--warning)]';
  if (a === 'DELETE') return 'bg-[var(--danger)]/15 text-[var(--danger)]';
  if (a === 'ORDER_STATUS') return 'bg-[var(--accent-soft)] text-[var(--accent)]';
  return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
}

function historyLabel(h: UnifiedHistoryResponse): string {
  const entity = h.entityLabel ?? `#${h.entityId ?? ''}`;
  const a = h.action;
  const t = h.entityType;
  if (a === 'CREATE') return `Tạo mới ${t?.toLowerCase() ?? 'bản ghi'} ${entity}`;
  if (a === 'UPDATE') return `Cập nhật ${t?.toLowerCase() ?? 'bản ghi'} ${entity}`;
  if (a === 'DELETE') return `Xóa ${t?.toLowerCase() ?? 'bản ghi'} ${entity}`;
  if (a === 'ORDER_STATUS') return `Đổi trạng thái đơn ${entity}`;
  return `${a} ${entity}`;
}

function timeAgo(iso: string): string {
  try {
    const d = parseISO(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)}p trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
    return format(d, 'dd/MM/yyyy', { locale: vi });
  } catch {
    return '—';
  }
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const card = 'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-2xl bg-[var(--bg-elevated)]', className)} />;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  subColor,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: typeof TrendingUp;
  iconBg: string;
  iconColor: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div
      className={clsx(
        card,
        'relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        accent && `border-l-[3px]`,
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
          )}
          {sub && !loading && (
            <p className={clsx('mt-1 text-[11px] font-medium', subColor ?? 'text-[var(--text-muted)]')}>
              {sub}
            </p>
          )}
          {loading && <Skeleton className="mt-1.5 h-3.5 w-32" />}
        </div>
        <div
          className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ orders, loading }: { orders: OrderDto[]; loading: boolean }) {
  const [range, setRange] = useState<DayRange>(30);

  const data = useMemo(() => buildRevenueData(orders, range), [orders, range]);

  const totalRevenue = useMemo(
    () => data.reduce((s, d) => s + d.revenue, 0),
    [data],
  );

  const customTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={clsx(card, 'px-3 py-2 text-xs')}>
        <p className="font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-[var(--accent)]">{formatPrice(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className={clsx(card, 'p-5')}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <TrendingUp className="mr-1 inline size-3" /> Tổng quan doanh thu
          </p>
          <p className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {loading ? '…' : fmtRevenue(totalRevenue)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Doanh thu từ đơn hoàn thành · {range} ngày
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 p-1">
          {([7, 30, 90] as DayRange[]).map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                range === d
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {d}N
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval={range === 7 ? 0 : range === 30 ? 4 : 14}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmtRevenue(v)}
                width={52}
              />
              <Tooltip content={customTooltip as never} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--accent)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Status Donut ─────────────────────────────────────────────────────────────

function StatusDonut({ orders, loading }: { orders: OrderDto[]; loading: boolean }) {
  const data = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const o of orders) {
      const s = o.status ?? 0;
      if (s in counts) counts[s]++;
    }
    return Object.entries(counts)
      .map(([s, count]) => ({
        status: Number(s),
        count,
        ...STATUS_CONFIG[Number(s)],
      }))
      .filter((d) => d.count > 0);
  }, [orders]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className={clsx(card, 'p-5')}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <ShoppingCart className="mr-1 inline size-3" /> Đơn theo trạng thái
      </p>
      <p className="mb-4 text-xs text-[var(--text-muted)]">Phân bổ tất cả đơn hàng</p>

      {loading ? (
        <Skeleton className="mx-auto h-36 w-36 rounded-full" />
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          <ShoppingCart className="mb-2 size-8 opacity-40" />
          <p className="text-sm">Chưa có đơn hàng</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <div style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="count"
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, _: string, p: { payload: { label: string } }) => [
                      `${v} đơn (${Math.round((v / total) * 100)}%)`,
                      p.payload.label,
                    ]}
                    contentStyle={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
              return (
                <div key={d.status} className="flex items-center gap-2">
                  <span
                    className="size-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                    {d.label}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {d.count}
                  </span>
                  <span className="w-8 text-right text-xs text-[var(--text-muted)]">{pct}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Recent Orders Table ──────────────────────────────────────────────────────

function RecentOrdersTable({ orders, loading }: { orders: OrderDto[]; loading: boolean }) {
  const sorted = useMemo(
    () =>
      [...orders]
        .sort((a, b) => {
          const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return db - da;
        })
        .slice(0, 8),
    [orders],
  );

  return (
    <div className={clsx(card, 'overflow-hidden')}>
      <div className="flex items-center justify-between border-b border-[var(--bg-border)] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <Clock className="mr-1 inline size-3" /> Đơn hàng gần nhất
          </p>
          <p className="text-xs text-[var(--text-muted)]">Sắp xếp theo thời gian tạo mới nhất</p>
        </div>
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          Xem tất cả <ArrowRight className="size-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <ShoppingCart className="mb-2 size-10 opacity-30" />
          <p className="text-sm">Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/50">
                {['Mã đơn', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Ngày tạo', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const st = STATUS_CONFIG[o.status ?? 0];
                return (
                  <tr
                    key={o.id}
                    className="group border-b border-[var(--bg-border)] transition-colors last:border-0 hover:bg-[var(--bg-elevated)]/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {o.orderCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {formatPrice(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          o.paid
                            ? 'bg-[var(--success)]/15 text-[var(--success)]'
                            : 'bg-[var(--warning)]/15 text-[var(--warning)]',
                        )}
                      >
                        <span
                          className={clsx(
                            'size-1.5 rounded-full',
                            o.paid ? 'bg-[var(--success)]' : 'bg-[var(--warning)]',
                          )}
                        />
                        {o.paid ? 'Đã TT' : 'Chưa TT'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {st ? (
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            st.bg,
                            st.text,
                          )}
                        >
                          {st.label}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {o.createdDate
                        ? format(parseISO(o.createdDate), 'dd/MM/yyyy HH:mm', { locale: vi })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="invisible inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)] group-hover:visible"
                      >
                        Xem <ArrowRight className="size-2.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({
  items,
  loading,
}: {
  items: UnifiedHistoryResponse[];
  loading: boolean;
}) {
  return (
    <div className={clsx(card, 'p-5')}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <Activity className="mr-1 inline size-3" /> Hoạt động gần đây
      </p>
      <p className="mb-4 text-xs text-[var(--text-muted)]">Lịch sử admin hệ thống</p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 flex-shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
          <History className="mb-2 size-8 opacity-30" />
          <p className="text-sm">Chưa có hoạt động nào</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-px bg-[var(--bg-border)]" />
          <div className="space-y-4">
            {items.map((h, i) => (
              <div key={h.id ?? i} className="relative flex gap-3">
                <div
                  className={clsx(
                    'relative z-10 flex size-8 flex-shrink-0 items-center justify-center rounded-full',
                    historyColor(h),
                  )}
                >
                  {historyIcon(h)}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs font-semibold leading-snug text-[var(--text-primary)]">
                    {historyLabel(h)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {h.actorFullName ?? h.actorUsername ?? 'System'} · {timeAgo(h.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Nav ────────────────────────────────────────────────────────────────

const QUICK_NAV = [
  {
    to: '/admin/products',
    label: 'Sản phẩm',
    icon: Package,
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    color: 'text-amber-700 dark:text-amber-300',
  },
  {
    to: '/admin/categories',
    label: 'Danh mục',
    icon: FolderTree,
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    color: 'text-blue-700 dark:text-blue-300',
  },
  {
    to: '/admin/brands',
    label: 'Thương hiệu',
    icon: Award,
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    color: 'text-pink-700 dark:text-pink-300',
  },
  {
    to: '/admin/pricing/pwp',
    label: 'Khuyến mãi',
    icon: Tag,
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    color: 'text-violet-700 dark:text-violet-300',
  },
  {
    to: '/admin/staff',
    label: 'Nhân viên',
    icon: Shield,
    bg: 'bg-[var(--bg-elevated)]',
    color: 'text-[var(--text-secondary)]',
  },
  {
    to: '/admin/customers',
    label: 'Khách hàng',
    icon: Users,
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    color: 'text-teal-700 dark:text-teal-300',
  },
  {
    to: '/admin/orders',
    label: 'Đơn hàng',
    icon: ShoppingCart,
    bg: 'bg-green-100 dark:bg-green-900/30',
    color: 'text-green-700 dark:text-green-300',
  },
  {
    to: '/admin/history',
    label: 'Lịch sử',
    icon: History,
    bg: 'bg-[var(--bg-elevated)]',
    color: 'text-[var(--text-secondary)]',
  },
  {
    to: '/admin/warehouse',
    label: 'Kho hàng',
    icon: Warehouse,
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    color: 'text-orange-700 dark:text-orange-300',
  },
  {
    to: '/admin/reports',
    label: 'Báo cáo',
    icon: BarChart2,
    bg: 'bg-red-100 dark:bg-red-900/30',
    color: 'text-red-700 dark:text-red-300',
  },
  {
    to: '/admin/documents',
    label: 'Tài liệu',
    icon: FileStack,
    bg: 'bg-[var(--bg-elevated)]',
    color: 'text-[var(--text-secondary)]',
  },
  {
    to: '/admin/settings',
    label: 'Cài đặt',
    icon: Settings,
    bg: 'bg-[var(--bg-elevated)]',
    color: 'text-[var(--text-secondary)]',
  },
] as const;

function QuickNavGrid({
  categoriesCount,
  brandsCount,
  loading,
}: {
  categoriesCount: number | null;
  brandsCount: number | null;
  loading: boolean;
}) {
  return (
    <div className={clsx(card, 'p-5')}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <ClipboardList className="mr-1 inline size-3" /> Quản lý nhanh
      </p>
      <p className="mb-4 text-xs text-[var(--text-muted)]">Truy cập nhanh các module</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {QUICK_NAV.map(({ to, label, icon: Icon, bg, color }) => (
          <Link
            key={to}
            to={to}
            className={clsx(
              'group flex flex-col items-center gap-2 rounded-xl border border-[var(--bg-border)] p-3',
              'transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-md',
            )}
          >
            <div
              className={clsx(
                'flex size-9 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-110',
                bg,
                color,
              )}
            >
              <Icon className="size-4" aria-hidden />
            </div>
            <span className="text-center text-[10px] font-semibold leading-tight text-[var(--text-secondary)]">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Chào buổi sáng' : now.getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateStr = format(now, "EEEE, dd MMMM yyyy", { locale: vi });

  const [
    ordersQ,
    productsQ,
    customersQ,
    staffQ,
    promotionsQ,
    historyQ,
    categoriesQ,
    brandsQ,
  ] = useQueries({
    queries: [
      {
        queryKey: ['admin-dashboard', 'orders-all'],
        queryFn: () => adminOrderService.listOrders(),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin-dashboard', 'products-total'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const { metadata } = await adminProductService.list({ page: 0, limit: 1, signal });
          return metadata?.totalElements ?? null;
        },
        staleTime: 120_000,
      },
      {
        queryKey: ['admin-dashboard', 'customers-total'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const { totalElements } = await adminCustomerService.listPaged(0, 1, signal);
          return totalElements ?? null;
        },
        staleTime: 120_000,
      },
      {
        queryKey: ['admin-dashboard', 'staff-total'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const { totalElements } = await adminStaffService.listPaged(0, 1, signal);
          return totalElements ?? null;
        },
        staleTime: 120_000,
      },
      {
        queryKey: ['admin-dashboard', 'promotions'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminPromotionService.listPurchaseWithPurchase(signal),
        staleTime: 120_000,
      },
      {
        queryKey: ['admin-dashboard', 'history'],
        queryFn: () => adminHistoryService.search({ size: 8 }),
        staleTime: 30_000,
      },
      {
        queryKey: ['admin-dashboard', 'categories'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminCategoryService.list(signal),
        staleTime: 300_000,
      },
      {
        queryKey: ['admin-dashboard', 'brands'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminBrandService.list(signal),
        staleTime: 300_000,
      },
    ],
  });

  const orders = ordersQ.data ?? [];
  const ordersLoading = ordersQ.isPending;

  const revenue = useMemo(
    () => orders.filter((o) => o.status === 4).reduce((s, o) => s + (o.total ?? 0), 0),
    [orders],
  );

  const staffTotal = staffQ.data ?? null;

  const historyItems = historyQ.data?.items ?? [];

  return (
    <div className="space-y-5">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className={clsx(card, 'relative overflow-hidden p-5')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--accent-soft)]/60 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {greeting} 👋
            </p>
            <h1 className="mt-0.5 font-[family-name:var(--font-admin-heading)] text-xl font-bold text-[var(--text-primary)]">
              Tổng quan hệ thống
            </h1>
            <p className="mt-0.5 text-xs capitalize text-[var(--text-muted)]">{dateStr}</p>
          </div>
          <Link
            to="/admin/pricing/pwp"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden />
            Tạo khuyến mãi
          </Link>
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Doanh thu (đơn hoàn thành)"
          value={ordersLoading ? '…' : fmtRevenue(revenue)}
          sub={ordersLoading ? undefined : `${orders.filter((o) => o.status === 4).length} đơn hoàn thành`}
          icon={CircleDollarSign}
          iconBg="rgba(34,197,94,0.12)"
          iconColor="var(--success)"
          loading={ordersLoading}
        />
        <StatCard
          label="Tổng đơn hàng"
          value={ordersLoading ? '…' : fmtCount(orders.length)}
          sub={
            ordersLoading
              ? undefined
              : `${orders.filter((o) => o.status === 1).length} đang chờ chuẩn bị`
          }
          icon={ShoppingCart}
          iconBg="rgba(79,142,247,0.12)"
          iconColor="var(--accent)"
          loading={ordersLoading}
        />
        <StatCard
          label="Tổng sản phẩm"
          value={productsQ.isPending ? '…' : fmtCount(productsQ.data)}
          sub="Tổng SKU trong kho"
          icon={Package}
          iconBg="rgba(251,191,36,0.12)"
          iconColor="var(--warning)"
          loading={productsQ.isPending}
        />
        <StatCard
          label="Khách hàng"
          value={customersQ.isPending ? '…' : fmtCount(customersQ.data)}
          sub="Tổng tài khoản khách hàng"
          icon={Users}
          iconBg="rgba(79,142,247,0.12)"
          iconColor="var(--info)"
          loading={customersQ.isPending}
        />
        <StatCard
          label="Nhân sự"
          value={staffQ.isPending ? '…' : fmtCount(staffTotal)}
          sub="Tổng nhân viên"
          icon={Shield}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="#8B5CF6"
          loading={staffQ.isPending}
        />
        <StatCard
          label="Khuyến mãi PWP"
          value={promotionsQ.isPending ? '…' : fmtCount(promotionsQ.data?.length ?? 0)}
          sub="Purchase-with-purchase đang chạy"
          icon={Tag}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="#8B5CF6"
          accent="#8B5CF6"
          loading={promotionsQ.isPending}
        />
      </div>

      {/* ── CHARTS ROW ─────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <RevenueChart orders={orders} loading={ordersLoading} />
        <StatusDonut orders={orders} loading={ordersLoading} />
      </div>

      {/* ── RECENT ORDERS TABLE ────────────────────────────────────── */}
      <RecentOrdersTable orders={orders} loading={ordersLoading} />

      {/* ── BOTTOM ROW ─────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <ActivityFeed items={historyItems} loading={historyQ.isPending} />
        <QuickNavGrid
          categoriesCount={categoriesQ.data?.length ?? null}
          brandsCount={brandsQ.data?.length ?? null}
          loading={categoriesQ.isPending || brandsQ.isPending}
        />
      </div>
    </div>
  );
}

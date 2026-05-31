import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  PackageX,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { adminOrderService } from '../../api/services/adminOrderService';
import type { OrderDto } from '../../api/types/order.types';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD = 'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';

const RETURN_STATUS = {
  1: { label: 'Yêu cầu trả', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  2: { label: 'Đã chấp nhận', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  3: { label: 'Đang hoàn tiền', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  4: { label: 'Hoàn tiền xong', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  5: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
} as const;

type ReturnStatusKey = keyof typeof RETURN_STATUS;

// Valid admin transitions: from -> list of allowed `to` values
const ALLOWED_TRANSITIONS: Record<number, number[]> = {
  1: [2, 5],
  2: [3, 5],
  3: [4, 5],
};

function getNextActions(currentStatus: number): { status: number; label: string; variant: 'primary' | 'danger' }[] {
  const nexts = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  return nexts.map((s) => ({
    status: s,
    label: s === 5 ? 'Từ chối' : RETURN_STATUS[s as ReturnStatusKey]?.label ?? String(s),
    variant: s === 5 ? 'danger' : 'primary',
  }));
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReturnStatusBadge({ status }: { status: number }) {
  const cfg = RETURN_STATUS[status as ReturnStatusKey];
  if (!cfg) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={clsx(CARD, 'flex items-center gap-4 p-5')}>
      <div className={clsx('flex size-11 shrink-0 items-center justify-center rounded-xl', color)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function formatVnd(amount?: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch {
    return dateStr;
  }
}

// ─── Action Modal ──────────────────────────────────────────────────────────────

function ReturnActionModal({
  order,
  onClose,
  onUpdated,
}: {
  order: OrderDto;
  onClose: () => void;
  onUpdated: (updated: OrderDto) => void;
}) {
  const [note, setNote] = useState('');
  const canUpdate = adminAccessControlUi.canViewOrders();

  const mutation = useMutation({
    mutationFn: ({ status, note }: { status: number; note?: string }) =>
      adminOrderService.updateReturnStatus(order.id, status, note),
    onSuccess: (updated) => {
      toast.success(`Cập nhật trạng thái trả hàng thành công`);
      onUpdated(updated);
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    },
  });

  const actions = getNextActions(order.returnRefundStatus ?? 0);
  const currentStatus = order.returnRefundStatus ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={clsx(CARD, 'w-full max-w-lg')}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--bg-border)] p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <PackageX className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Xử lý trả hàng</p>
            <p className="text-xs text-[var(--text-muted)]">{order.orderCode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <XCircle className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Current state */}
          <div className="rounded-xl bg-[var(--bg-elevated)] p-4">
            <p className="mb-1 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Trạng thái hiện tại</p>
            <ReturnStatusBadge status={currentStatus} />
            {order.returnRefundNote && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                <span className="font-medium">Lý do KH: </span>{order.returnRefundNote}
              </p>
            )}
          </div>

          {/* Order summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Tổng đơn</p>
              <p className="font-semibold text-[var(--text-primary)]">{formatVnd(order.total)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Ngày đặt</p>
              <p className="font-semibold text-[var(--text-primary)]">{formatDate(order.createdDate)}</p>
            </div>
          </div>

          {/* Note input */}
          {actions.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Ghi chú admin (tuỳ chọn)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Nhập lý do hoặc ghi chú..."
                className="w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              />
            </div>
          )}

          {/* Action buttons */}
          {canUpdate && actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ status: action.status, note: note.trim() || undefined })}
                  className={clsx(
                    'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
                    action.variant === 'danger'
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60'
                      : 'bg-[var(--accent)] text-white hover:opacity-90'
                  )}
                >
                  {mutation.isPending ? 'Đang xử lý...' : action.label}
                </button>
              ))}
            </div>
          ) : actions.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)]">Yêu cầu đã được xử lý xong.</p>
          ) : (
            <p className="text-center text-sm text-rose-500">Bạn không có quyền cập nhật trạng thái trả hàng.</p>
          )}
        </div>

        {/* Footer link */}
        <div className="border-t border-[var(--bg-border)] px-5 py-3">
          <Link
            to={`/admin/orders/${order.id}`}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <FileText className="size-3.5" />
            Xem chi tiết đơn hàng
            <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: number | null }[] = [
  { label: 'Tất cả', value: null },
  { label: 'Yêu cầu trả', value: 1 },
  { label: 'Đã chấp nhận', value: 2 },
  { label: 'Đang hoàn tiền', value: 3 },
  { label: 'Hoàn tiền xong', value: 4 },
  { label: 'Từ chối', value: 5 },
];

export default function AdminReturnOrdersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);

  const { data: allOrders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-orders-returns'],
    queryFn: () => adminOrderService.listOrders(),
    select: (orders) => orders.filter((o) => (o.returnRefundStatus ?? 0) > 0),
    staleTime: 30_000,
  });

  // Stats
  const stats = {
    total: allOrders.length,
    requested: allOrders.filter((o) => o.returnRefundStatus === 1).length,
    processing: allOrders.filter((o) => o.returnRefundStatus === 2 || o.returnRefundStatus === 3).length,
    completed: allOrders.filter((o) => o.returnRefundStatus === 4).length,
    rejected: allOrders.filter((o) => o.returnRefundStatus === 5).length,
  };

  const filtered = activeTab == null ? allOrders : allOrders.filter((o) => o.returnRefundStatus === activeTab);

  function handleUpdated(updated: OrderDto) {
    queryClient.setQueryData<OrderDto[]>(['admin-orders-returns'], (prev) =>
      prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev
    );
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-order', updated.id] });
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/orders"
            className="flex size-8 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Quản lý trả hàng</h1>
            <p className="text-xs text-[var(--text-muted)]">Xử lý yêu cầu trả hàng & hoàn tiền từ khách hàng</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className="size-4" />
          Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={PackageX} label="Tổng yêu cầu" value={stats.total} color="bg-[var(--accent-soft)] text-[var(--accent)]" />
        <StatCard icon={Clock} label="Chờ xử lý" value={stats.requested} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" />
        <StatCard icon={Banknote} label="Đang xử lý" value={stats.processing} color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
        <StatCard icon={CheckCircle2} label="Hoàn tất" value={stats.completed} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" />
      </div>

      {/* Tabs + Table */}
      <div className={CARD}>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--bg-border)] px-4 pt-3">
          {TABS.map((tab) => (
            <button
              key={String(tab.value)}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={clsx(
                'shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
              {tab.value !== null && (
                <span className="ml-1.5 rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  {allOrders.filter((o) => o.returnRefundStatus === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">
            <RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải...
          </div>
        ) : isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-rose-500">
            <XCircle className="size-8" />
            <p className="text-sm">Không tải được dữ liệu</p>
            <button type="button" onClick={() => refetch()} className="text-xs underline">
              Thử lại
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
            <PackageX className="size-10 opacity-30" />
            <p className="text-sm">Không có yêu cầu nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-5 py-3">Mã đơn</th>
                  <th className="px-5 py-3">Tổng tiền</th>
                  <th className="px-5 py-3">Ngày đặt</th>
                  <th className="px-5 py-3">Lý do trả</th>
                  <th className="px-5 py-3">Trạng thái trả</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bg-border)]">
                {filtered.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-[var(--bg-elevated)]/50">
                    <td className="px-5 py-4">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-mono text-[var(--accent)] hover:underline"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                      {formatVnd(order.total)}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">
                      {formatDate(order.createdDate)}
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate text-[var(--text-secondary)]" title={order.returnRefundNote ?? ''}>
                        {order.returnRefundNote || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <ReturnStatusBadge status={order.returnRefundStatus ?? 0} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                      >
                        Xử lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedOrder && (
        <ReturnActionModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

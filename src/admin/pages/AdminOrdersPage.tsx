import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminOrderService } from '../../api/services/adminOrderService';
import { StatusBadge } from '../components/pricing/StatusBadge';
import type { StatusBadgeTone } from '../components/pricing/StatusBadge';
import { formatPrice } from '../../lib/formatPrice';

// ─── Hằng số trạng thái ────────────────────────────────────────────────────

type StatusKey = 1 | 2 | 3 | 4 | 5;

const STATUS_LABEL: Record<StatusKey, string> = {
  1: 'Chờ chuẩn bị',
  2: 'Chờ vận chuyển',
  3: 'Chờ giao hàng',
  4: 'Hoàn thành',
  5: 'Đã hủy',
};

const STATUS_TONE: Record<StatusKey, StatusBadgeTone> = {
  1: 'warning',
  2: 'info',
  3: 'info',
  4: 'success',
  5: 'danger',
};

/** Các trạng thái kế tiếp hợp lệ theo luồng admin (4 & 5 là terminal). */
const NEXT_STATUSES: Record<StatusKey, StatusKey[]> = {
  1: [2, 5],
  2: [3, 5],
  3: [4, 5],
  4: [],
  5: [],
};

function statusLabel(s: number): string {
  return STATUS_LABEL[(s as StatusKey)] ?? `Trạng thái ${s}`;
}

function statusTone(s: number): StatusBadgeTone {
  return STATUS_TONE[(s as StatusKey)] ?? 'neutral';
}

function nextStatuses(s: number): StatusKey[] {
  return NEXT_STATUSES[(s as StatusKey)] ?? [];
}

// ─── Filter tabs ────────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: number | undefined }[] = [
  { label: 'Tất cả', value: undefined },
  { label: 'Chờ chuẩn bị', value: 1 },
  { label: 'Chờ vận chuyển', value: 2 },
  { label: 'Chờ giao hàng', value: 3 },
  { label: 'Hoàn thành', value: 4 },
  { label: 'Đã hủy', value: 5 },
];

// ─── Confirm dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({
  orderCode,
  currentStatus,
  nextStatus,
  onConfirm,
  onCancel,
  isPending,
}: {
  orderCode: string;
  currentStatus: number;
  nextStatus: StatusKey;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
        <h2 className="font-[family-name:var(--font-admin-heading)] text-base font-semibold text-[var(--text-primary)]">
          Xác nhận cập nhật trạng thái
        </h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Đơn hàng{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{orderCode}</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge tone={statusTone(currentStatus)} label={statusLabel(currentStatus)} />
          <span className="text-xs text-[var(--text-muted)]">→</span>
          <StatusBadge tone={statusTone(nextStatus)} label={statusLabel(nextStatus)} />
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {nextStatus === 5
            ? 'Thao tác hủy đơn không thể hoàn tác sau khi xác nhận.'
            : 'Sau khi xác nhận, không thể quay về trạng thái trước.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60',
              nextStatus === 5
                ? 'bg-[var(--danger)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-white hover:opacity-90'
            )}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline status selector ─────────────────────────────────────────────────

function StatusSelector({
  orderId,
  orderCode,
  currentStatus,
  onMutate,
}: {
  orderId: number;
  orderCode: string;
  currentStatus: number;
  onMutate: (id: number, status: StatusKey) => void;
}) {
  const nexts = nextStatuses(currentStatus);
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StatusKey | null>(null);

  // Terminal status — plain badge, no interaction
  if (nexts.length === 0) {
    return <StatusBadge tone={statusTone(currentStatus)} label={statusLabel(currentStatus)} />;
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Bấm để cập nhật trạng thái"
          className={clsx(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors',
            'border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
            'hover:border-[var(--accent)]/50 hover:text-[var(--accent)]'
          )}
        >
          <span
            className={clsx(
              'size-1.5 rounded-full',
              currentStatus === 1 && 'bg-[var(--warning)]',
              (currentStatus === 2 || currentStatus === 3) && 'bg-[var(--info)]'
            )}
            aria-hidden
          />
          {statusLabel(currentStatus)}
          <ChevronDown className="size-3" aria-hidden />
        </button>

        {open && (
          <>
            {/* Backdrop to close */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] py-1 shadow-lg">
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Chuyển sang
              </p>
              {nexts.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setOpen(false);
                    setPendingStatus(s);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-elevated)]"
                >
                  <StatusBadge tone={statusTone(s)} label={statusLabel(s)} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {pendingStatus !== null && (
        <ConfirmDialog
          orderCode={orderCode}
          currentStatus={currentStatus}
          nextStatus={pendingStatus}
          isPending={false}
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => {
            onMutate(orderId, pendingStatus);
            setPendingStatus(null);
          }}
        />
      )}
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [activeStatus, setActiveStatus] = useState<number | undefined>(undefined);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['admin-orders', activeStatus],
    queryFn: () => adminOrderService.listOrders(activeStatus),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      adminOrderService.updateOrderStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(`Đơn ${updated.orderCode} → ${statusLabel(updated.status ?? 0)}`, {
        id: `order-status-${updated.id}`,
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    },
  });

  const handleMutate = (id: number, status: StatusKey) => {
    updateMutation.mutate({ id, status });
  };

  const orders = listQuery.data ?? [];
  const mutatingId =
    updateMutation.isPending && updateMutation.variables
      ? (updateMutation.variables as { id: number }).id
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
          Quản lý đơn hàng
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Xem và cập nhật trạng thái đơn hàng. Bấm badge trạng thái để chuyển bước tiếp theo.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={String(tab.value ?? 'all')}
            onClick={() => setActiveStatus(tab.value)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              activeStatus === tab.value
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-8 text-sm text-[var(--text-muted)]">
          <Loader2 className="size-5 animate-spin text-[var(--accent)]" aria-hidden />
          Đang tải danh sách…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : 'Không tải được danh sách đơn.'}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          Không có đơn hàng nào
          {activeStatus != null ? ` ở trạng thái "${statusLabel(activeStatus)}"` : ''}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thanh toán</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bg-border)]">
                {orders.map((o) => {
                  const isMutating = mutatingId === o.id;
                  return (
                    <tr
                      key={o.id}
                      className={clsx(
                        'transition-colors hover:bg-[var(--bg-elevated)]/30',
                        isMutating && 'opacity-60'
                      )}
                    >
                      {/* Order code */}
                      <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                        {o.orderCode}
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {o.createdDate
                          ? new Date(o.createdDate).toLocaleString('vi-VN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>

                      {/* Status — interactive dropdown for non-terminal */}
                      <td className="px-4 py-3">
                        {isMutating ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            Đang cập nhật…
                          </span>
                        ) : (
                          <StatusSelector
                            orderId={o.id}
                            orderCode={o.orderCode}
                            currentStatus={o.status ?? 0}
                            onMutate={handleMutate}
                          />
                        )}
                      </td>

                      {/* Payment method + paid status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {o.paymentMethod?.name ?? '—'}
                          </span>
                          {o.paymentMethod?.code === 'VNPAY' && (
                            o.paid ? (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--success)]/40 bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                                <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
                                Đã thanh toán
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                                <span className="size-1.5 rounded-full bg-[var(--warning)]" aria-hidden />
                                Chưa thanh toán
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                        {formatPrice(o.total)}
                      </td>

                      {/* Detail link */}
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className={clsx(
                            'inline-flex rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-semibold',
                            'text-[var(--accent)] hover:bg-[var(--bg-elevated)]'
                          )}
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

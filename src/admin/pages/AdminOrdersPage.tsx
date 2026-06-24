import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronDown, Loader2, RotateCcw } from 'lucide-react';
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

const NEXT_STATUSES: Record<StatusKey, StatusKey[]> = {
  1: [2, 5], // Chờ chuẩn bị → Chờ vận chuyển hoặc Đã hủy
  2: [3],    // Chờ vận chuyển → chỉ tiến tới Chờ giao hàng (không cho hủy)
  3: [4],    // Chờ giao hàng → chỉ Hoàn thành (không cho hủy)
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

/** Nhãn trạng thái trả hàng hiển thị trong danh sách đơn. */
const RETURN_BADGE: Record<number, { label: string; cls: string }> = {
  1: { label: 'Yêu cầu trả', cls: 'border-amber-300/50 bg-amber-100 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/40 dark:text-amber-300' },
  2: { label: 'Đang xử lý trả', cls: 'border-blue-300/50 bg-blue-100 text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/40 dark:text-blue-300' },
  3: { label: 'Đang hoàn tiền', cls: 'border-purple-300/50 bg-purple-100 text-purple-700 dark:border-purple-800/40 dark:bg-purple-900/40 dark:text-purple-300' },
  4: { label: 'Đã trả hàng', cls: 'border-rose-300/50 bg-rose-100 text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/40 dark:text-rose-300' },
  5: { label: 'Từ chối trả', cls: 'border-zinc-300/50 bg-zinc-100 text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800/60 dark:text-zinc-400' },
};

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

// ─── Inline status selector (fixed-position dropdown — avoids table overflow clipping) ──

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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      });
    }
  }, [open]);

  // Terminal status — plain badge, no interaction
  if (nexts.length === 0) {
    return <StatusBadge tone={statusTone(currentStatus)} label={statusLabel(currentStatus)} />;
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        title="Bấm để cập nhật trạng thái"
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
          open
            ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
            : 'border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]'
        )}
      >
        <span
          className={clsx(
            'size-1.5 rounded-full shrink-0',
            currentStatus === 1 && 'bg-[var(--warning)]',
            (currentStatus === 2 || currentStatus === 3) && 'bg-[var(--info,#60a5fa)]'
          )}
          aria-hidden
        />
        {statusLabel(currentStatus)}
        <ChevronDown
          className={clsx('size-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {/* Transparent full-screen backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

          {/* Dropdown rendered at fixed coordinates — never clipped by table overflow */}
          <div
            style={dropdownStyle}
            className="min-w-[12rem] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] py-1 shadow-xl"
          >
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Chuyển sang
            </p>
            {nexts.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setOpen(false);
                  setPendingStatus(s);
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  'hover:bg-[var(--bg-elevated)]',
                  s === 5 && 'text-[var(--danger)]'
                )}
              >
                <StatusBadge tone={statusTone(s)} label={statusLabel(s)} />
              </button>
            ))}
          </div>
        </>
      )}

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
        /* Table — no overflow:hidden on the card so dropdowns can escape */
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
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
                      <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                        {o.orderCode}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {o.createdDate
                          ? new Date(o.createdDate).toLocaleString('vi-VN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
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
                          {o.returnRefundStatus != null && RETURN_BADGE[o.returnRefundStatus] && (
                            <Link
                              to={`/admin/returns/${o.id}`}
                              title="Xem xử lý trả hàng"
                              className={clsx(
                                'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80',
                                RETURN_BADGE[o.returnRefundStatus].cls
                              )}
                            >
                              <RotateCcw className="size-3" aria-hidden />
                              {RETURN_BADGE[o.returnRefundStatus].label}
                            </Link>
                          )}
                        </div>
                      </td>
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
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                        {formatPrice(o.total)}
                      </td>
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

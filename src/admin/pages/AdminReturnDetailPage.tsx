import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  PackageX,
  XCircle,
  FileText,
  ChevronRight,
  ImageIcon,
  Video as VideoIcon,
  X,
  Play,
  Trash2,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { adminOrderService } from '../../api/services/adminOrderService';
import type { OrderReturnMedia } from '../../api/types/order.types';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD =
  'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';

const RETURN_STATUS = {
  1: { label: 'Yêu cầu trả', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  2: { label: 'Đã chấp nhận', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  3: { label: 'Đang hoàn tiền', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  4: { label: 'Hoàn tiền xong', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  5: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
} as const;

type ReturnStatusKey = keyof typeof RETURN_STATUS;

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

function ReturnStatusBadge({ status }: { status: number }) {
  const cfg = RETURN_STATUS[status as ReturnStatusKey];
  if (!cfg) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.color)}>
      {cfg.label}
    </span>
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

/** Tách `returnRefundNote` thành lý do KH + các trường có cấu trúc (refundMethod, bank...). */
function parseReturnNote(note?: string | null): { reason: string; meta: { label: string; value: string }[] } {
  if (!note) return { reason: '', meta: [] };
  const parts = note.split('|').map((p) => p.trim());
  const reason = parts.shift() ?? '';
  const labelMap: Record<string, string> = {
    refundMethod: 'Hình thức hoàn tiền',
    bank: 'Ngân hàng',
    acct: 'Số tài khoản',
    email: 'Email',
  };
  const meta = parts
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) return null;
      const key = p.slice(0, eq).trim();
      const value = p.slice(eq + 1).trim();
      if (!value) return null;
      return { label: labelMap[key] ?? key, value };
    })
    .filter((x): x is { label: string; value: string } => x !== null);
  return { reason, meta };
}

function isVideo(m: OrderReturnMedia): boolean {
  if (m.type && m.type.toUpperCase() === 'VIDEO') return true;
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(m.url);
}

// ─── Media gallery + lightbox ────────────────────────────────────────────────

function ReturnMediaGallery({
  media,
  canDelete,
  onDelete,
  deletingId,
}: {
  media: OrderReturnMedia[];
  canDelete?: boolean;
  onDelete?: (m: OrderReturnMedia) => void;
  deletingId?: number | null;
}) {
  const [active, setActive] = useState<OrderReturnMedia | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {media.map((m, idx) => {
          const video = isVideo(m);
          const deleting = deletingId != null && m.id === deletingId;
          return (
            <div
              key={m.id ?? idx}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]"
            >
              <button
                type="button"
                onClick={() => setActive(m)}
                className="size-full focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                title={video ? 'Xem video' : 'Xem ảnh'}
              >
                {video ? (
                  <>
                    <video
                      src={m.url}
                      className="size-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
                      <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-black">
                        <Play className="size-5" />
                      </span>
                    </span>
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      <VideoIcon className="size-3" /> Video
                    </span>
                  </>
                ) : (
                  <img src={m.url} alt={`Bằng chứng ${idx + 1}`} className="size-full object-cover" loading="lazy" />
                )}
              </button>

              {canDelete && onDelete && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => onDelete(m)}
                  aria-label="Xoá media"
                  title="Xoá ảnh / video"
                  className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-rose-600/90 text-white opacity-0 transition-opacity hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox viewer (xem media phóng to) */}
      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setActive(null)}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          {isVideo(active) ? (
            <video src={active.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
          ) : (
            <img src={active.url} alt="Bằng chứng trả hàng" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminReturnDetailPage() {
  const { orderId: orderIdParam } = useParams<{ orderId: string }>();
  const orderId = Number(orderIdParam);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const canUpdate = adminAccessControlUi.canViewOrders();

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-order', orderId],
    queryFn: () => adminOrderService.getOrderById(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  const mutation = useMutation({
    mutationFn: ({ status, note }: { status: number; note?: string }) =>
      adminOrderService.updateReturnStatus(orderId, status, note),
    onSuccess: (updated) => {
      toast.success('Cập nhật trạng thái trả hàng thành công');
      queryClient.setQueryData(['admin-order', orderId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-orders-returns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setNote('');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    },
  });

  const parsed = useMemo(() => parseReturnNote(order?.returnRefundNote), [order?.returnRefundNote]);
  const media = order?.returnMedia ?? [];
  const currentStatus = order?.returnRefundStatus ?? 0;
  const actions = getNextActions(currentStatus);

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: number) => adminOrderService.deleteReturnMedia(orderId, mediaId),
    onSuccess: (updated) => {
      toast.success('Đã xoá ảnh / video');
      queryClient.setQueryData(['admin-order', orderId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-orders-returns'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Xoá thất bại');
    },
  });

  const handleDeleteMedia = (m: OrderReturnMedia) => {
    if (m.id == null) return;
    if (!window.confirm('Xoá ảnh / video bằng chứng này? Hành động không thể hoàn tác.')) return;
    deleteMediaMutation.mutate(m.id);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/returns"
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <PackageX className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Chi tiết trả hàng</h1>
            <p className="text-xs text-[var(--text-muted)]">{order?.orderCode ?? `#${orderIdParam}`}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className="size-4" />
          Làm mới
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-[var(--text-muted)]">
          <RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải...
        </div>
      ) : isError || !order ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-rose-500">
          <XCircle className="size-8" />
          <p className="text-sm">Không tải được đơn hàng</p>
          <button type="button" onClick={() => refetch()} className="text-xs underline">
            Thử lại
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: info + media */}
          <div className="space-y-6 lg:col-span-2">
            {/* Status + reason */}
            <div className={clsx(CARD, 'p-5')}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Trạng thái hiện tại
                </p>
                <ReturnStatusBadge status={currentStatus} />
              </div>
              {parsed.reason && (
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Lý do KH: </span>
                  {parsed.reason}
                </p>
              )}
              {parsed.meta.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {parsed.meta.map((m) => (
                    <div key={m.label}>
                      <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Media */}
            <div className={clsx(CARD, 'p-5')}>
              <div className="mb-4 flex items-center gap-2">
                <ImageIcon className="size-4 text-[var(--text-muted)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Ảnh / video bằng chứng
                </h2>
                <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  {media.length}
                </span>
              </div>
              {media.length > 0 ? (
                <ReturnMediaGallery
                  media={media}
                  canDelete={canUpdate}
                  onDelete={handleDeleteMedia}
                  deletingId={deleteMediaMutation.isPending ? (deleteMediaMutation.variables ?? null) : null}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-[var(--text-muted)]">
                  <ImageIcon className="size-10 opacity-30" />
                  <p className="text-sm">Khách hàng không gửi kèm ảnh / video</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: summary + actions */}
          <div className="space-y-6">
            <div className={clsx(CARD, 'p-5')}>
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Thông tin đơn</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Mã đơn</dt>
                  <dd className="font-mono font-medium text-[var(--text-primary)]">{order.orderCode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Tổng đơn</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">{formatVnd(order.total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Ngày đặt</dt>
                  <dd className="text-[var(--text-primary)]">{formatDate(order.createdDate)}</dd>
                </div>
              </dl>
              <Link
                to={`/admin/orders/${order.id}`}
                className="mt-4 flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
              >
                <FileText className="size-3.5" />
                Xem chi tiết đơn hàng
                <ChevronRight className="size-3" />
              </Link>
            </div>

            {/* Actions */}
            <div className={clsx(CARD, 'p-5')}>
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Xử lý yêu cầu</h2>
              {actions.length === 0 ? (
                <p className="text-center text-sm text-[var(--text-muted)]">Yêu cầu đã được xử lý xong.</p>
              ) : !canUpdate ? (
                <p className="text-center text-sm text-rose-500">
                  Bạn không có quyền cập nhật trạng thái trả hàng.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                      Ghi chú admin (tuỳ chọn)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Nhập lý do hoặc ghi chú..."
                      className="w-full resize-none rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ status: action.status, note: note.trim() || undefined })}
                        className={clsx(
                          'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
                          action.variant === 'danger'
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60'
                            : 'bg-[var(--accent)] text-white hover:opacity-90'
                        )}
                      >
                        {mutation.isPending ? 'Đang xử lý...' : action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

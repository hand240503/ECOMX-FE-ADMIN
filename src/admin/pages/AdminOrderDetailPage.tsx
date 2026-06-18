import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  CreditCard,
  MapPin,
  ShoppingBag,
  Tag,
  Receipt,
  ChevronDown,
  AlertCircle,
  Box,
  Layers,
  Hash,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminOrderService } from '../../api/services/adminOrderService';
import type { CreatedOrderDetail, OrderLinePricingPrograms } from '../../api/types/order.types';
import { formatPricingEpochMs, normalizeOrderDetailsFromOrder } from '../../lib/adminOrderDetails';
import { formatPrice } from '../../lib/formatPrice';
import { StatusBadge } from '../components/pricing/StatusBadge';
import type { StatusBadgeTone } from '../components/pricing/StatusBadge';

// ─── Status helpers ──────────────────────────────────────────────────────────

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

function orderStatusLabel(s: number): string {
  return STATUS_LABEL[(s as StatusKey)] ?? `Trạng thái ${s}`;
}
function statusTone(s: number): StatusBadgeTone {
  return STATUS_TONE[(s as StatusKey)] ?? 'neutral';
}
function nextStatuses(s: number): StatusKey[] {
  return NEXT_STATUSES[(s as StatusKey)] ?? [];
}

function hasReconciliationContent(p: OrderLinePricingPrograms): boolean {
  const vt = p.volumeTier;
  const hasVtAgg =
    vt != null &&
    (vt.aggregateQuantityForVariantOnOrder != null ||
      vt.aggregateQuantityForProductOnOrder != null);
  return !!(
    p.pricedAtEpochMs != null ||
    p.catalogUnitPrice != null ||
    p.effectiveUnitBeforeVolumeTier != null ||
    p.finalUnitPrice != null ||
    p.lineTotal != null ||
    p.priceChange ||
    (vt && (vt.minQuantity != null || vt.tierUnitPrice != null || hasVtAgg)) ||
    p.purchaseWithPurchase
  );
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const card =
  'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';
const sectionTitle =
  'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-3';
const pill =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold';

// ─── Reconciliation helpers ──────────────────────────────────────────────────

function ReconciliationDl({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={clsx(
        'grid gap-2 text-sm sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-x-4',
        className,
      )}
    >
      {children}
    </dl>
  );
}
function Dt({ children }: { children: ReactNode }) {
  return (
    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </dt>
  );
}
function Dd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dd className={clsx('min-w-0 break-words text-[var(--text-primary)]', className)}>
      {children}
    </dd>
  );
}

function OrderLinePricingAccordion({ programs }: { programs: OrderLinePricingPrograms }) {
  const [open, setOpen] = useState(false);
  const pc = programs.priceChange;
  const vt = programs.volumeTier;
  const pwp = programs.purchaseWithPurchase;

  const tags: { label: string; color: string }[] = [];
  if (pc) tags.push({ label: 'GIẢM GIÁ THEO GIỜ', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' });
  if (vt) tags.push({ label: 'GIÁ BẬC SỐ LƯỢNG', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' });
  if (pwp) tags.push({ label: 'MUA KÈM', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' });
  if (programs.catalogUnitPrice != null) tags.push({ label: 'GIÁ THÀNH VIÊN', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' });

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="size-3.5 text-[var(--accent)]" />
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
            Đối soát giá · Chương trình đã áp dụng
          </span>
          {tags.map((t) => (
            <span key={t.label} className={clsx(pill, t.color, 'py-0.5')}>
              {t.label}
            </span>
          ))}
        </div>
        <ChevronDown
          className={clsx(
            'size-4 flex-shrink-0 text-[var(--accent)] transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--bg-border)]/60 px-4 pb-4 pt-3">
          <ReconciliationDl>
            <Dt>Thời điểm tính giá</Dt>
            <Dd>{formatPricingEpochMs(programs.pricedAtEpochMs)}</Dd>
            {programs.catalogUnitPrice != null && (
              <>
                <Dt>Giá niêm yết</Dt>
                <Dd>{formatPrice(programs.catalogUnitPrice)}</Dd>
              </>
            )}
            {programs.effectiveUnitBeforeVolumeTier != null && (
              <>
                <Dt>Giá sau KM, trước bậc SL</Dt>
                <Dd>{formatPrice(programs.effectiveUnitBeforeVolumeTier)}</Dd>
              </>
            )}
            {programs.finalUnitPrice != null && (
              <>
                <Dt>Đơn giá thanh toán</Dt>
                <Dd className="font-semibold">{formatPrice(programs.finalUnitPrice)}</Dd>
              </>
            )}
            {programs.lineTotal != null && (
              <>
                <Dt>Thành tiền</Dt>
                <Dd>{formatPrice(programs.lineTotal)}</Dd>
              </>
            )}
          </ReconciliationDl>

          {pc &&
            (pc.id != null ||
              pc.basePrice != null ||
              pc.salePrice != null ||
              pc.resolvedUnitPrice != null) && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Khuyến mãi giá (Price Change)
                </p>
                <ReconciliationDl className="!gap-1.5">
                  {pc.basePrice != null && (
                    <>
                      <Dt>Giá gốc</Dt>
                      <Dd>{formatPrice(pc.basePrice)}</Dd>
                    </>
                  )}
                  {pc.salePrice != null && (
                    <>
                      <Dt>Giá khuyến mãi</Dt>
                      <Dd>{formatPrice(pc.salePrice)}</Dd>
                    </>
                  )}
                  {pc.resolvedUnitPrice != null && (
                    <>
                      <Dt>Đơn giá áp dụng</Dt>
                      <Dd>{formatPrice(pc.resolvedUnitPrice)}</Dd>
                    </>
                  )}
                  {pc.startEpochMs != null && (
                    <>
                      <Dt>Hiệu lực từ</Dt>
                      <Dd>{formatPricingEpochMs(pc.startEpochMs)}</Dd>
                    </>
                  )}
                  {pc.endEpochMs != null && (
                    <>
                      <Dt>Hiệu lực đến</Dt>
                      <Dd>{formatPricingEpochMs(pc.endEpochMs)}</Dd>
                    </>
                  )}
                </ReconciliationDl>
              </div>
            )}

          {vt &&
            (vt.minQuantity != null ||
              vt.tierUnitPrice != null ||
              vt.aggregateQuantityForVariantOnOrder != null ||
              vt.aggregateQuantityForProductOnOrder != null) && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  Giảm theo số lượng (Volume Tier)
                </p>
                <ReconciliationDl className="!gap-1.5">
                  {vt.minQuantity != null && (
                    <>
                      <Dt>SL tối thiểu áp bậc</Dt>
                      <Dd>{vt.minQuantity}</Dd>
                    </>
                  )}
                  {vt.tierUnitPrice != null && (
                    <>
                      <Dt>Đơn giá bậc</Dt>
                      <Dd>{formatPrice(vt.tierUnitPrice)}</Dd>
                    </>
                  )}
                  {vt.aggregateQuantityForVariantOnOrder != null && (
                    <>
                      <Dt>Tổng SL cùng phân loại</Dt>
                      <Dd>{vt.aggregateQuantityForVariantOnOrder}</Dd>
                    </>
                  )}
                  {vt.aggregateQuantityForProductOnOrder != null && (
                    <>
                      <Dt>Tổng SL cùng sản phẩm</Dt>
                      <Dd>{vt.aggregateQuantityForProductOnOrder}</Dd>
                    </>
                  )}
                </ReconciliationDl>
              </div>
            )}

          {pwp &&
            (pwp.offerId != null ||
              pwp.role != null ||
              pwp.anchorVariantId != null ||
              pwp.companionVariantId != null ||
              pwp.promoQuantity != null ||
              pwp.regularQuantity != null ||
              pwp.promoUnitPrice != null) && (
              <div className="rounded-xl border border-violet-200/60 bg-violet-50/50 p-3 dark:border-violet-800/40 dark:bg-violet-900/10">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Mua kèm ưu đãi (PWP)
                </p>
                <ReconciliationDl className="!gap-1.5">
                  {pwp.offerId != null && (
                    <>
                      <Dt>Mã chương trình</Dt>
                      <Dd>{pwp.offerId}</Dd>
                    </>
                  )}
                  {pwp.role != null && (
                    <>
                      <Dt>Vai trò dòng hàng</Dt>
                      <Dd>{pwp.role === 'anchor' ? 'Sản phẩm chính' : 'Sản phẩm đi kèm'}</Dd>
                    </>
                  )}
                  {pwp.anchorVariantId != null && (
                    <>
                      <Dt>Phân loại sản phẩm chính</Dt>
                      <Dd>{pwp.anchorVariantId}</Dd>
                    </>
                  )}
                  {pwp.companionVariantId != null && (
                    <>
                      <Dt>Phân loại đi kèm</Dt>
                      <Dd>{pwp.companionVariantId}</Dd>
                    </>
                  )}
                  {pwp.promoQuantity != null && (
                    <>
                      <Dt>SL áp giá ưu đãi</Dt>
                      <Dd>{pwp.promoQuantity}</Dd>
                    </>
                  )}
                  {pwp.regularQuantity != null && (
                    <>
                      <Dt>SL giá thường</Dt>
                      <Dd>{pwp.regularQuantity}</Dd>
                    </>
                  )}
                  {pwp.promoUnitPrice != null && (
                    <>
                      <Dt>Đơn giá ưu đãi</Dt>
                      <Dd>{formatPrice(pwp.promoUnitPrice)}</Dd>
                    </>
                  )}
                  {pwp.regularUnitPriceAfterPrograms != null && (
                    <>
                      <Dt>Đơn giá thường (sau CT khác)</Dt>
                      <Dd>{formatPrice(pwp.regularUnitPriceAfterPrograms)}</Dd>
                    </>
                  )}
                </ReconciliationDl>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ─── Product timeline ────────────────────────────────────────────────────────

function ProductTimeline({ lines }: { lines: CreatedOrderDetail[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="relative">
      <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-[var(--accent)]/40 via-[var(--accent)]/20 to-transparent" />
      <div className="space-y-3">
        {lines.map((line, i) => {
          const programs = line.pricingPrograms;
          const showAccordion = programs != null && hasReconciliationContent(programs);
          return (
            <div key={line.id} className="relative flex gap-4">
              <div className="relative z-10 flex-shrink-0">
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-[var(--accent)]/30 bg-[var(--bg-surface)] text-xs font-bold text-[var(--accent)] shadow-sm">
                  {i + 1}
                </div>
              </div>
              <div className={clsx(card, 'flex-1 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="size-12 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--bg-border)] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--bg-elevated)]">
                        {line.thumbnailUrl ? (
                          <img
                            src={line.thumbnailUrl}
                            alt={line.productName ?? ''}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--accent)]">
                            <Box className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-[var(--text-primary)]">
                          {line.productName?.trim() || `Sản phẩm #${line.productId}`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                            <Hash className="size-3" />
                            ID: {line.productId}
                          </span>
                          {line.skuCode && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                              <Layers className="size-3" />
                              SKU: {line.skuCode}
                            </span>
                          )}
                          {line.productVariantId != null && line.productVariantId > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                              Variant: {line.productVariantId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-[var(--text-muted)]">
                      {line.quantity} × {line.unitPrice != null ? formatPrice(line.unitPrice) : '—'}
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
                      {line.lineTotal != null ? formatPrice(line.lineTotal) : '—'}
                    </p>
                  </div>
                </div>
                {showAccordion ? (
                  <OrderLinePricingAccordion programs={programs} />
                ) : (
                  <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-3 py-2.5 text-xs text-[var(--text-muted)]">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    Không có dữ liệu chương trình giá (đơn cũ hoặc BE chưa trả snapshot).
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Order status timeline ───────────────────────────────────────────────────

const TIMELINE_STEPS: { status: StatusKey; label: string; icon: typeof Clock }[] = [
  { status: 1, label: 'Chờ chuẩn bị', icon: Clock },
  { status: 2, label: 'Chờ vận chuyển', icon: PackageCheck },
  { status: 3, label: 'Chờ giao hàng', icon: Truck },
  { status: 4, label: 'Hoàn thành', icon: CheckCircle2 },
];

function OrderStatusTimeline({
  currentStatus,
  onNext,
  isPending,
  onCancel,
}: {
  currentStatus: number;
  onNext: (s: StatusKey) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const isCancelled = currentStatus === 5;
  const isTerminal = currentStatus === 4 || currentStatus === 5;

  return (
    <div className={clsx(card, 'p-5')}>
      <p className={sectionTitle}>
        <CheckCircle2 className="size-3.5" />
        Trạng thái đơn hàng
      </p>

      {isCancelled ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/8 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--danger)]/15 text-[var(--danger)]">
            <Ban className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-[var(--danger)]">Đã hủy đơn</p>
            <p className="text-xs text-[var(--text-muted)]">Đơn hàng này đã bị hủy và không thể khôi phục.</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-5 right-5 h-px bg-[var(--bg-border)]" />
          <div
            className="absolute left-5 top-5 h-px bg-gradient-to-r from-[var(--accent)] to-[var(--success)] transition-all duration-700"
            style={{ width: `${Math.min(((currentStatus - 1) / 3) * 100, 100)}%` }}
          />
          <div className="relative flex justify-between">
            {TIMELINE_STEPS.map((step) => {
              const done = currentStatus >= step.status;
              const active = currentStatus === step.status;
              const Icon = step.icon;
              return (
                <div key={step.status} className="flex flex-col items-center gap-2">
                  <div
                    className={clsx(
                      'flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                      done && !active && 'border-[var(--success)] bg-[var(--success)] text-white shadow-[0_0_12px_rgba(52,211,153,0.4)]',
                      active && 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(79,142,247,0.5)]',
                      !done && 'border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
                    )}
                  >
                    {done && !active ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                  </div>
                  <p className={clsx('text-center text-[11px] font-semibold leading-tight', done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Đang cập nhật trạng thái…
          </div>
        ) : isTerminal ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-4 py-3 text-xs text-[var(--text-muted)]">
            <AlertCircle className="size-3.5 flex-shrink-0 text-[var(--accent)]" />
            Đơn đã ở trạng thái cuối — không thể chỉnh thêm.
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">Chuyển sang trạng thái:</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses(currentStatus).map((s) => (
                <button
                  key={s}
                  onClick={() => (s === 5 ? onCancel() : onNext(s))}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                    'transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-sm',
                    s === 5 ? 'bg-[var(--danger)] text-white' : 'bg-[var(--accent)] text-white',
                  )}
                >
                  {s === 5 ? <Ban className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                  {orderStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-2xl bg-[var(--bg-elevated)]', className)} />;
}
function OrderDetailSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-44" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-36" />
        <SkeletonBlock className="h-36" />
      </div>
      <SkeletonBlock className="h-64" />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const idNum = orderId ? Number(orderId) : NaN;
  const validId = Number.isFinite(idNum) && idNum > 0;
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<StatusKey | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelNoteError, setCancelNoteError] = useState('');

  const orderQuery = useQuery({
    queryKey: ['admin-order', idNum],
    queryFn: () => adminOrderService.getOrderById(idNum),
    enabled: validId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ status, note }: { status: number; note?: string }) =>
      adminOrderService.updateOrderStatus(idNum, status, note),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-order', idNum], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(`Trạng thái → ${orderStatusLabel(updated.status ?? 0)}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    },
  });

  const order = orderQuery.data;
  const lines = order ? normalizeOrderDetailsFromOrder(order) : [];
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const shippingFee = order?.shippingFeeVnd ?? 0;
  const shippingDiscount = order?.shippingDiscountVnd ?? 0;
  const shopDiscount = order?.shopVoucherDiscountVnd ?? 0;
  const totalDiscount = shippingDiscount + shopDiscount;

  return (
    <div className="min-h-screen">
      {/* Back link */}
      <div className="mb-5">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] transition-opacity hover:opacity-75"
        >
          <ChevronLeft className="size-4" />
          Danh sách đơn hàng
        </Link>
      </div>

      {!validId ? (
        <div className={clsx(card, 'flex items-center gap-3 p-6 text-[var(--danger)]')}>
          <AlertCircle className="size-5 flex-shrink-0" />
          <p className="text-sm font-medium">Mã đơn không hợp lệ.</p>
        </div>
      ) : orderQuery.isLoading ? (
        <OrderDetailSkeleton />
      ) : orderQuery.isError ? (
        <div className={clsx(card, 'flex items-center gap-3 p-6 text-[var(--danger)]')}>
          <AlertCircle className="size-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {orderQuery.error instanceof Error ? orderQuery.error.message : 'Không tải được đơn.'}
          </p>
        </div>
      ) : order ? (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

          {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* 1. HEADER */}
            <div className={clsx(card, 'relative overflow-hidden p-6')}>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--accent-soft)]/50 via-transparent to-transparent" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Receipt className="size-4 text-[var(--accent)]" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      Chi tiết đơn hàng
                    </p>
                  </div>
                  <h1 className="font-mono text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
                    {order.orderCode}
                  </h1>
                  {order.createdDate && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Tạo lúc{' '}
                      {new Date(order.createdDate).toLocaleString('vi-VN', {
                        dateStyle: 'long',
                        timeStyle: 'medium',
                      })}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Tổng đơn
                  </p>
                  <p className="mt-0.5 text-3xl font-extrabold text-[var(--text-primary)]">
                    {formatPrice(order.total)}
                  </p>
                  <div className="mt-2">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                        (order.status ?? 0) === 1 && 'bg-amber-100 text-amber-700 shadow-[0_0_12px_rgba(251,191,36,0.3)] dark:bg-amber-900/30 dark:text-amber-300',
                        ((order.status ?? 0) === 2 || (order.status ?? 0) === 3) && 'bg-blue-100 text-blue-700 shadow-[0_0_12px_rgba(79,142,247,0.3)] dark:bg-blue-900/30 dark:text-blue-300',
                        (order.status ?? 0) === 4 && 'bg-emerald-100 text-emerald-700 shadow-[0_0_12px_rgba(52,211,153,0.3)] dark:bg-emerald-900/30 dark:text-emerald-300',
                        (order.status ?? 0) === 5 && 'bg-red-100 text-red-600 shadow-[0_0_12px_rgba(248,113,113,0.3)] dark:bg-red-900/30 dark:text-red-400',
                      )}
                    >
                      <span
                        className={clsx(
                          'size-1.5 rounded-full',
                          (order.status ?? 0) === 1 && 'bg-amber-500',
                          ((order.status ?? 0) === 2 || (order.status ?? 0) === 3) && 'bg-blue-500',
                          (order.status ?? 0) === 4 && 'bg-emerald-500',
                          (order.status ?? 0) === 5 && 'bg-red-500',
                        )}
                      />
                      {orderStatusLabel(order.status ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1b. CANCEL NOTE — chỉ hiện khi đơn đã hủy và có lý do */}
            {order.status === 5 && order.cancelNote && (
              <div className={clsx(card, 'flex items-start gap-3 border-[var(--danger)]/30 bg-[var(--danger)]/[0.04] p-4')}>
                <Ban className="mt-0.5 size-4 flex-shrink-0 text-[var(--danger)]" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--danger)]">Lý do hủy đơn</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{order.cancelNote}</p>
                </div>
              </div>
            )}

            {/* 2. STATUS TIMELINE */}
            <OrderStatusTimeline
              currentStatus={order.status ?? 0}
              isPending={updateMutation.isPending}
              onNext={(s) => { setCancelNote(''); setCancelNoteError(''); setPendingStatus(s); }}
              onCancel={() => { setCancelNote(''); setCancelNoteError(''); setPendingStatus(5); }}
            />

            {/* 3. PAYMENT + DELIVERY */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={clsx(card, 'p-5')}>
                <p className={sectionTitle}>
                  <CreditCard className="size-3.5" />
                  Thanh toán
                </p>
                {order.paymentMethod ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
                        <CreditCard className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{order.paymentMethod.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">Mã: {order.paymentMethod.code}</p>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        'flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold',
                        order.paid
                          ? 'border border-emerald-200/60 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/15 dark:text-emerald-300'
                          : 'border border-amber-200/60 bg-amber-50/60 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-300',
                      )}
                    >
                      <span className={clsx('size-2 rounded-full', order.paid ? 'bg-emerald-500' : 'bg-amber-500')} />
                      {order.paid ? (
                        <>
                          Đã thanh toán
                          {order.paidAt && (
                            <span className="ml-1 font-normal text-[var(--text-muted)]">
                              · {new Date(order.paidAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                        </>
                      ) : (
                        'Chưa thanh toán'
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">Không có thông tin thanh toán.</p>
                )}
              </div>

              <div className={clsx(card, 'p-5')}>
                <p className={sectionTitle}>
                  <MapPin className="size-3.5" />
                  Giao hàng
                </p>
                {order.deliveryAddress ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
                        <User className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Địa chỉ giao hàng</p>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)]">{order.deliveryAddress}</p>
                      </div>
                    </div>
                    {order.deliveryDistanceMeters != null && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-3 py-2 text-xs text-[var(--text-secondary)]">
                        <Truck className="size-3.5 text-[var(--accent)]" />
                        Khoảng cách: {(order.deliveryDistanceMeters / 1000).toFixed(1)} km
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">Không có địa chỉ giao hàng.</p>
                )}
              </div>
            </div>

            {/* 4. PRODUCT TIMELINE */}
            <div className={clsx(card, 'p-5')}>
              <p className={sectionTitle}>
                <ShoppingBag className="size-3.5" />
                Sản phẩm đặt hàng
                <span className="ml-auto rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">
                  {lines.length} dòng
                </span>
              </p>
              {lines.length > 0 ? (
                <ProductTimeline lines={lines} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                    <ShoppingBag className="size-7" />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">Không có sản phẩm nào.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ────────────────────────────────────────── */}
          <div className="w-full lg:w-[300px] lg:flex-shrink-0">
            <div className="space-y-4 lg:sticky lg:top-6">

              {/* Summary card */}
              <div className={clsx(card, 'overflow-hidden')}>
                <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)] px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/70">Tóm tắt đơn hàng</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-white/90">{order.orderCode}</p>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Tạm tính</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {subtotal > 0 ? formatPrice(subtotal) : formatPrice(order.total)}
                    </span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Giảm giá</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        − {formatPrice(totalDiscount)}
                      </span>
                    </div>
                  )}
                  {shippingFee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Phí vận chuyển</span>
                      <span className="font-medium text-[var(--text-primary)]">{formatPrice(shippingFee)}</span>
                    </div>
                  )}
                  <div className="my-1 h-px bg-gradient-to-r from-transparent via-[var(--bg-border)] to-transparent" />
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">Tổng thanh toán</span>
                    <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)] bg-clip-text text-2xl font-extrabold text-transparent">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Meta card */}
              <div className={clsx(card, 'p-5')}>
                <p className={sectionTitle}>
                  <Receipt className="size-3.5" />
                  Thông tin đơn
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Mã đơn</span>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">{order.orderCode}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Số dòng hàng</span>
                    <span className="font-semibold text-[var(--text-primary)]">{lines.length}</span>
                  </div>
                  {order.createdDate && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Ngày tạo</span>
                      <span className="text-right text-[var(--text-primary)]">
                        {new Date(order.createdDate).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  )}
                  {order.modifiedDate && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Cập nhật</span>
                      <span className="text-right text-[var(--text-primary)]">
                        {new Date(order.modifiedDate).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Thanh toán</span>
                    <span className={clsx('font-semibold', order.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                      {order.paid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── CONFIRM DIALOG ──────────────────────────────────────────── */}
      {pendingStatus !== null && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className={clsx(card, 'w-full max-w-sm p-6 shadow-[0_24px_64px_rgba(0,0,0,0.25)]')}>
            <div className="flex items-center gap-3">
              <div className={clsx('flex size-10 items-center justify-center rounded-xl', pendingStatus === 5 ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>
                {pendingStatus === 5 ? <Ban className="size-5" /> : <ArrowRight className="size-5" />}
              </div>
              <h2 className="font-[family-name:var(--font-admin-heading)] text-base font-semibold text-[var(--text-primary)]">
                Xác nhận cập nhật trạng thái
              </h2>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 p-3">
              <p className="text-xs text-[var(--text-muted)]">Đơn hàng</p>
              <p className="font-mono font-bold text-[var(--text-primary)]">{order.orderCode}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge tone={statusTone(order.status ?? 0)} label={orderStatusLabel(order.status ?? 0)} />
                <ArrowRight className="size-3 text-[var(--text-muted)]" />
                <StatusBadge tone={statusTone(pendingStatus)} label={orderStatusLabel(pendingStatus)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {pendingStatus === 5
                ? '⚠️ Hủy đơn không thể hoàn tác sau khi xác nhận.'
                : 'Sau khi xác nhận, không thể quay về trạng thái trước.'}
            </p>

            {/* Lý do hủy — chỉ hiện khi pendingStatus === 5 */}
            {pendingStatus === 5 && (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  Lý do hủy đơn
                  <span className="ml-1 text-[var(--danger)]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelNote}
                  onChange={(e) => {
                    setCancelNote(e.target.value);
                    if (cancelNoteError) setCancelNoteError('');
                  }}
                  disabled={updateMutation.isPending}
                  placeholder="Nhập lý do hủy đơn…"
                  maxLength={500}
                  className={clsx(
                    'w-full resize-none rounded-xl border px-3 py-2 text-sm text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2',
                    'bg-[var(--bg-elevated)] disabled:opacity-60',
                    cancelNoteError
                      ? 'border-[var(--danger)] focus:ring-[var(--danger)]/20'
                      : 'border-[var(--bg-border)] focus:ring-[var(--accent)]/20',
                  )}
                />
                <div className="mt-1 flex justify-between gap-2">
                  {cancelNoteError ? (
                    <p className="text-xs text-[var(--danger)]">{cancelNoteError}</p>
                  ) : <span />}
                  <p className={clsx('text-xs tabular-nums', cancelNote.length > 480 ? 'text-amber-500' : 'text-[var(--text-muted)]')}>
                    {cancelNote.length}/500
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPendingStatus(null);
                  setCancelNote('');
                  setCancelNoteError('');
                }}
                disabled={updateMutation.isPending}
                className="rounded-xl border border-[var(--bg-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  const s = pendingStatus;
                  if (s === 5) {
                    const trimmed = cancelNote.trim();
                    if (!trimmed) {
                      setCancelNoteError('Vui lòng nhập lý do hủy đơn.');
                      return;
                    }
                    if (trimmed.length > 500) {
                      setCancelNoteError('Lý do không được vượt quá 500 ký tự.');
                      return;
                    }
                    setPendingStatus(null);
                    setCancelNote('');
                    setCancelNoteError('');
                    updateMutation.mutate({ status: s, note: trimmed });
                  } else {
                    setPendingStatus(null);
                    updateMutation.mutate({ status: s });
                  }
                }}
                disabled={updateMutation.isPending}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white',
                  'transition-all duration-150 active:scale-[0.97] disabled:opacity-50',
                  pendingStatus === 5 ? 'bg-[var(--danger)] hover:opacity-90' : 'bg-[var(--accent)] hover:opacity-90',
                )}
              >
                {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

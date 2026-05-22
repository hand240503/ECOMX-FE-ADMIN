import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminOrderService } from '../../api/services/adminOrderService';
import type { CreatedOrderDetail, OrderLinePricingPrograms } from '../../api/types/order.types';
import { formatPricingEpochMs, normalizeOrderDetailsFromOrder } from '../../lib/adminOrderDetails';
import { formatPrice } from '../../lib/formatPrice';
import { StatusBadge } from '../components/pricing/StatusBadge';
import type { StatusBadgeTone } from '../components/pricing/StatusBadge';

// ─── Status helpers ─────────────────────────────────────────────────────────

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
  1: [2, 5],
  2: [3, 5],
  3: [4, 5],
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
    (vt.aggregateQuantityForVariantOnOrder != null || vt.aggregateQuantityForProductOnOrder != null);
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

function ReconciliationDl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={clsx('grid gap-2 text-sm sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-x-4', className)}>
      {children}
    </dl>
  );
}

function Dt({ children }: { children: ReactNode }) {
  return (
    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{children}</dt>
  );
}

function Dd({ children }: { children: ReactNode }) {
  return <dd className="min-w-0 break-words text-[var(--text-primary)]">{children}</dd>;
}

function OrderLinePricingAccordion({ programs }: { programs: OrderLinePricingPrograms }) {
  const pc = programs.priceChange;
  const vt = programs.volumeTier;
  const pwp = programs.purchaseWithPurchase;

  return (
    <details className="group mt-3 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)]/20 open:border-[var(--accent)]/40">
      <summary
        className={clsx(
          'cursor-pointer list-none px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)]',
          'marker:content-none [&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="select-none group-open:underline">Đối soát giá · Chương trình đã áp dụng</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--bg-border)]/80 px-3 py-3">
        <ReconciliationDl>
          <Dt>Thời điểm tính giá</Dt>
          <Dd>{formatPricingEpochMs(programs.pricedAtEpochMs)}</Dd>
          {programs.catalogUnitPrice != null ? (
            <>
              <Dt>Giá niêm yết</Dt>
              <Dd>{formatPrice(programs.catalogUnitPrice)}</Dd>
            </>
          ) : null}
          {programs.effectiveUnitBeforeVolumeTier != null ? (
            <>
              <Dt>Giá sau khuyến mãi, trước bậc số lượng</Dt>
              <Dd>{formatPrice(programs.effectiveUnitBeforeVolumeTier)}</Dd>
            </>
          ) : null}
          {programs.finalUnitPrice != null ? (
            <>
              <Dt>Đơn giá thanh toán</Dt>
              <Dd className="font-semibold">{formatPrice(programs.finalUnitPrice)}</Dd>
            </>
          ) : null}
          {programs.lineTotal != null ? (
            <>
              <Dt>Thành tiền</Dt>
              <Dd>{formatPrice(programs.lineTotal)}</Dd>
            </>
          ) : null}
        </ReconciliationDl>

        {pc && (pc.id != null || pc.basePrice != null || pc.salePrice != null || pc.resolvedUnitPrice != null) ? (
          <div className="rounded-md border border-[color:var(--success)]/35 bg-[color:var(--success)]/8 p-2.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--success)]">
              Khuyến mãi giá (Price Change)
            </p>
            <ReconciliationDl className="!gap-1.5">
              {pc.basePrice != null ? (
                <>
                  <Dt>Giá gốc</Dt>
                  <Dd>{formatPrice(pc.basePrice)}</Dd>
                </>
              ) : null}
              {pc.salePrice != null ? (
                <>
                  <Dt>Giá khuyến mãi</Dt>
                  <Dd>{formatPrice(pc.salePrice)}</Dd>
                </>
              ) : null}
              {pc.resolvedUnitPrice != null ? (
                <>
                  <Dt>Đơn giá áp dụng</Dt>
                  <Dd>{formatPrice(pc.resolvedUnitPrice)}</Dd>
                </>
              ) : null}
              {pc.startEpochMs != null ? (
                <>
                  <Dt>Hiệu lực từ</Dt>
                  <Dd>{formatPricingEpochMs(pc.startEpochMs)}</Dd>
                </>
              ) : null}
              {pc.endEpochMs != null ? (
                <>
                  <Dt>Hiệu lực đến</Dt>
                  <Dd>{formatPricingEpochMs(pc.endEpochMs)}</Dd>
                </>
              ) : null}
            </ReconciliationDl>
          </div>
        ) : null}

        {vt &&
        (vt.minQuantity != null ||
          vt.tierUnitPrice != null ||
          vt.aggregateQuantityForVariantOnOrder != null ||
          vt.aggregateQuantityForProductOnOrder != null) ? (
          <div className="rounded-md border border-[color:var(--warning)]/45 bg-[color:var(--warning)]/10 p-2.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Giảm giá theo số lượng (Volume Tier)
            </p>
            <ReconciliationDl className="!gap-1.5">
              {vt.minQuantity != null ? (
                <>
                  <Dt>Số lượng tối thiểu áp bậc</Dt>
                  <Dd>{vt.minQuantity}</Dd>
                </>
              ) : null}
              {vt.tierUnitPrice != null ? (
                <>
                  <Dt>Đơn giá bậc</Dt>
                  <Dd>{formatPrice(vt.tierUnitPrice)}</Dd>
                </>
              ) : null}
              {vt.aggregateQuantityForVariantOnOrder != null ? (
                <>
                  <Dt>Tổng SL cùng phân loại trên đơn</Dt>
                  <Dd>{vt.aggregateQuantityForVariantOnOrder}</Dd>
                </>
              ) : null}
              {vt.aggregateQuantityForProductOnOrder != null ? (
                <>
                  <Dt>Tổng SL cùng sản phẩm trên đơn</Dt>
                  <Dd>{vt.aggregateQuantityForProductOnOrder}</Dd>
                </>
              ) : null}
            </ReconciliationDl>
          </div>
        ) : null}

        {pwp &&
        (pwp.offerId != null ||
          pwp.role != null ||
          pwp.anchorVariantId != null ||
          pwp.companionVariantId != null ||
          pwp.promoQuantity != null ||
          pwp.regularQuantity != null ||
          pwp.promoUnitPrice != null) ? (
          <div className="rounded-md border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 p-2.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              Mua kèm ưu đãi (PWP)
            </p>
            <ReconciliationDl className="!gap-1.5">
              {pwp.offerId != null ? (
                <>
                  <Dt>Mã chương trình</Dt>
                  <Dd>{pwp.offerId}</Dd>
                </>
              ) : null}
              {pwp.role != null ? (
                <>
                  <Dt>Vai trò dòng hàng</Dt>
                  <Dd>{pwp.role === 'anchor' ? 'Sản phẩm chính' : 'Sản phẩm đi kèm'}</Dd>
                </>
              ) : null}
              {pwp.anchorProductId != null ? (
                <>
                  <Dt>Mã sản phẩm chính</Dt>
                  <Dd>{pwp.anchorProductId}</Dd>
                </>
              ) : null}
              {pwp.anchorVariantId != null ? (
                <>
                  <Dt>Phân loại sản phẩm chính</Dt>
                  <Dd>{pwp.anchorVariantId}</Dd>
                </>
              ) : null}
              {pwp.companionProductId != null ? (
                <>
                  <Dt>Mã sản phẩm đi kèm</Dt>
                  <Dd>{pwp.companionProductId}</Dd>
                </>
              ) : null}
              {pwp.companionVariantId != null ? (
                <>
                  <Dt>Phân loại sản phẩm đi kèm</Dt>
                  <Dd>{pwp.companionVariantId}</Dd>
                </>
              ) : null}
              {pwp.promoQuantity != null ? (
                <>
                  <Dt>Số lượng áp giá ưu đãi</Dt>
                  <Dd>{pwp.promoQuantity}</Dd>
                </>
              ) : null}
              {pwp.regularQuantity != null ? (
                <>
                  <Dt>Số lượng giá thường</Dt>
                  <Dd>{pwp.regularQuantity}</Dd>
                </>
              ) : null}
              {pwp.promoUnitPrice != null ? (
                <>
                  <Dt>Đơn giá ưu đãi</Dt>
                  <Dd>{formatPrice(pwp.promoUnitPrice)}</Dd>
                </>
              ) : null}
              {pwp.regularUnitPriceAfterPrograms != null ? (
                <>
                  <Dt>Đơn giá thường (sau chương trình khác)</Dt>
                  <Dd>{formatPrice(pwp.regularUnitPriceAfterPrograms)}</Dd>
                </>
              ) : null}
            </ReconciliationDl>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function OrderLineCard({ line, index }: { line: CreatedOrderDetail; index: number }) {
  const programs = line.pricingPrograms;
  const showAccordion = programs != null && hasReconciliationContent(programs);

  return (
    <li className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            {line.productName?.trim() || `Sản phẩm #${line.productId}`}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Dòng {index + 1} · Mã SP: {line.productId}
            {line.productVariantId != null && line.productVariantId > 0
              ? ` · Phân loại: ${line.productVariantId}`
              : null}
            {line.skuCode ? ` · SKU: ${line.skuCode}` : null}
          </p>
        </div>
        <div className="text-end text-sm">
          <p className="text-[var(--text-secondary)]">
            SL <span className="font-semibold text-[var(--text-primary)]">{line.quantity}</span> ×{' '}
            {line.unitPrice != null ? formatPrice(line.unitPrice) : '—'}
          </p>
          <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
            {line.lineTotal != null ? formatPrice(line.lineTotal) : '—'}
          </p>
        </div>
      </div>

      {showAccordion ? (
        <OrderLinePricingAccordion programs={programs} />
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 px-2.5 py-2 text-xs text-[var(--text-muted)]">
          Không có dữ liệu chương trình giá (đơn cũ hoặc máy chủ chưa trả về snapshot) — chỉ hiển thị đơn giá / thành tiền đã lưu.
        </p>
      )}
    </li>
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const idNum = orderId ? Number(orderId) : NaN;
  const validId = Number.isFinite(idNum) && idNum > 0;
  const queryClient = useQueryClient();

  // Confirm dialog state
  const [pendingStatus, setPendingStatus] = useState<StatusKey | null>(null);

  const orderQuery = useQuery({
    queryKey: ['admin-order', idNum],
    queryFn: () => adminOrderService.getOrderById(idNum),
    enabled: validId,
  });

  const updateMutation = useMutation({
    mutationFn: (status: number) => adminOrderService.updateOrderStatus(idNum, status),
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/orders"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Danh sách đơn
        </Link>
        <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
          Chi tiết đơn hàng
        </h1>
      </div>

      {!validId ? (
        <div className="rounded-xl border border-[var(--danger)]/40 p-6 text-sm text-[var(--danger)]">
          Mã đơn không hợp lệ.
        </div>
      ) : orderQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-8 text-sm text-[var(--text-muted)]">
          <Loader2 className="size-5 animate-spin text-[var(--accent)]" aria-hidden />
          Đang tải đơn…
        </div>
      ) : orderQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 p-6 text-sm text-[var(--danger)]">
          {orderQuery.error instanceof Error ? orderQuery.error.message : 'Không tải được đơn.'}
        </div>
      ) : order ? (
        <>
          <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5 shadow-[var(--card-shadow)]">
            {/* Top row: order code + total */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-bold text-[var(--text-primary)]">{order.orderCode}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {order.createdDate
                    ? `Tạo lúc ${new Date(order.createdDate).toLocaleString('vi-VN', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}`
                    : null}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Tổng đơn</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{formatPrice(order.total)}</p>
              </div>
            </div>

            {/* Status update panel */}
            <div className="mt-4 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Trạng thái đơn hàng
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  tone={statusTone(order.status ?? 0)}
                  label={orderStatusLabel(order.status ?? 0)}
                />

                {updateMutation.isPending ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Đang cập nhật…
                  </span>
                ) : nextStatuses(order.status ?? 0).length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">Chuyển sang:</span>
                    {nextStatuses(order.status ?? 0).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPendingStatus(s)}
                        className={clsx(
                          'rounded-lg border px-3 py-1 text-xs font-semibold transition-colors',
                          s === 5
                            ? 'border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10'
                            : 'border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10'
                        )}
                      >
                        {orderStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">Trạng thái đã khoá — không thể chỉnh.</span>
                )}
              </div>
            </div>

            {order.paymentMethod?.name ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--bg-border)] pt-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Thanh toán:{' '}
                  <span className="text-[var(--text-primary)]">{order.paymentMethod.name}</span>
                </p>
                {order.paymentMethod.code === 'VNPAY' && (
                  order.paid ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success)]/40 bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                      <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
                      Đã thanh toán
                      {order.paidAt
                        ? ` · ${new Date(order.paidAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`
                        : null}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                      <span className="size-1.5 rounded-full bg-[var(--warning)]" aria-hidden />
                      Chưa thanh toán
                    </span>
                  )
                )}
              </div>
            ) : null}
            {order.deliveryAddress ? (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Giao hàng: <span className="text-[var(--text-primary)]">{order.deliveryAddress}</span>
              </p>
            ) : null}
          </div>

          {/* Confirm dialog */}
          {pendingStatus !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
                <h2 className="font-[family-name:var(--font-admin-heading)] text-base font-semibold text-[var(--text-primary)]">
                  Xác nhận cập nhật trạng thái
                </h2>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Đơn hàng{' '}
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{order.orderCode}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge tone={statusTone(order.status ?? 0)} label={orderStatusLabel(order.status ?? 0)} />
                  <span className="text-xs text-[var(--text-muted)]">→</span>
                  <StatusBadge tone={statusTone(pendingStatus)} label={orderStatusLabel(pendingStatus)} />
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  {pendingStatus === 5
                    ? 'Thao tác hủy đơn không thể hoàn tác sau khi xác nhận.'
                    : 'Sau khi xác nhận, không thể quay về trạng thái trước.'}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setPendingStatus(null)}
                    disabled={updateMutation.isPending}
                    className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => {
                      const s = pendingStatus;
                      setPendingStatus(null);
                      updateMutation.mutate(s);
                    }}
                    disabled={updateMutation.isPending}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60',
                      pendingStatus === 5
                        ? 'bg-[var(--danger)] text-white hover:opacity-90'
                        : 'bg-[var(--accent)] text-white hover:opacity-90'
                    )}
                  >
                    {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Dòng hàng &amp; đối soát giá</h2>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--bg-border)] p-6 text-sm text-[var(--text-muted)]">
                Đơn không có chi tiết dòng hàng từ API.
              </p>
            ) : (
              <ul className="space-y-3">
                {lines.map((line, idx) => (
                  <OrderLineCard key={line.id ?? idx} line={line} index={idx} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

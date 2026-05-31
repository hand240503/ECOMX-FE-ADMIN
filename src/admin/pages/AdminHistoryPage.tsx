import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { adminHistoryService } from '../../api/services/adminHistoryService';
import { StatusBadge } from '../components/pricing/StatusBadge';
import type { StatusBadgeTone } from '../components/pricing/StatusBadge';
import type {
  HistoryAction,
  HistoryEntityType,
  HistoryActorRole,
  UnifiedHistoryResponse,
  PriceEventType,
  PriceEventProgramType,
  PriceEventHistoryResponse,
} from '../../api/types/history.types';
import {
  ACTION_LABELS,
  ENTITY_TYPE_LABELS,
  PROGRAM_TYPE_LABELS,
  PRICE_EVENT_TYPE_LABELS,
} from '../../api/types/history.types';
import { formatPrice } from '../../lib/formatPrice';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// Source pills — "PRICE" là nguồn riêng, không phải tham số BE
type SourceKey = 'ALL' | 'ORDER_HISTORY' | 'ACTIVITY_LOG' | 'PRICE';

const SOURCE_PILLS: Array<{ label: string; value: SourceKey }> = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Đơn hàng', value: 'ORDER_HISTORY' },
  { label: 'Activity log', value: 'ACTIVITY_LOG' },
  { label: 'Lịch sử giá', value: 'PRICE' },
];

const ENTITY_TYPES_DATA: Array<{ label: string; value: HistoryEntityType }> = [
  { label: 'Đơn hàng', value: 'ORDER' },
  { label: 'Sản phẩm', value: 'PRODUCT' },
  { label: 'Thương hiệu', value: 'BRAND' },
  { label: 'Danh mục', value: 'CATEGORY' },
  { label: 'Giá theo TG', value: 'PRICE_CHANGE' },
  { label: 'Giá bậc', value: 'VOLUME_TIER' },
  { label: 'Mua kèm', value: 'PWP_OFFER' },
];

const ACTIONS_DATA: Array<{ label: string; value: HistoryAction }> = [
  { label: 'Tạo mới', value: 'CREATE' },
  { label: 'Cập nhật', value: 'UPDATE' },
  { label: 'Xóa', value: 'DELETE' },
  { label: 'Cập nhật trạng thái ĐH', value: 'ORDER_STATUS' },
  { label: 'Hoàn / Trả', value: 'RETURN_REFUND_STATUS' },
];

const ROLES_DATA: Array<{ label: string; value: HistoryActorRole }> = [
  { label: 'Nhân viên', value: 'EMPLOYEE' },
  { label: 'Quản lý', value: 'MANAGER' },
  { label: 'Quản trị viên', value: 'ADMIN' },
  { label: 'Quản trị cấp cao', value: 'SUPER_ADMIN' },
];

const PROGRAM_TYPES_DATA: Array<{ label: string; value: PriceEventProgramType }> = [
  { label: 'Giá theo TG', value: 'PRICE_CHANGE' },
  { label: 'Giá bậc SL', value: 'VOLUME_TIER' },
  { label: 'Mua kèm', value: 'PWP_OFFER' },
];

const PRICE_EVENT_TYPES_DATA: Array<{ label: string; value: PriceEventType }> = [
  { label: 'Tạo mới', value: 'CREATED' },
  { label: 'Cập nhật', value: 'UPDATED' },
  { label: 'Xóa', value: 'DELETED' },
  { label: 'Bật', value: 'ENABLED' },
  { label: 'Tắt', value: 'DISABLED' },
  { label: 'Bắt đầu (auto)', value: 'STARTED' },
  { label: 'Kết thúc (auto)', value: 'ENDED' },
  { label: 'Hết quota', value: 'EXPIRED' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function actionTone(action?: string): StatusBadgeTone {
  switch (action) {
    case 'CREATE': return 'success';
    case 'UPDATE': return 'info';
    case 'DELETE': return 'danger';
    case 'ORDER_STATUS': return 'warning';
    case 'RETURN_REFUND_STATUS': return 'neutral';
    default: return 'neutral';
  }
}

function sourceTone(source: string): StatusBadgeTone {
  return source === 'ORDER_HISTORY' ? 'warning' : 'info';
}

function sourceLabel(source: string): string {
  return source === 'ORDER_HISTORY' ? 'Đơn hàng' : 'Activity log';
}

function priceEventTone(eventType?: string): StatusBadgeTone {
  switch (eventType) {
    case 'CREATED': return 'success';
    case 'UPDATED': return 'info';
    case 'DELETED': return 'danger';
    case 'ENABLED': return 'success';
    case 'DISABLED': return 'neutral';
    case 'STARTED': return 'info';
    case 'ENDED': return 'neutral';
    case 'EXPIRED': return 'warning';
    default: return 'neutral';
  }
}

function programTypeTone(pt?: string): StatusBadgeTone {
  switch (pt) {
    case 'PRICE_CHANGE': return 'warning';
    case 'VOLUME_TIER': return 'info';
    case 'PWP_OFFER': return 'success';
    default: return 'neutral';
  }
}

// ─── Snapshot diff ────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  basePrice: 'Giá gốc', salePrice: 'Giá ưu đãi', price: 'Giá',
  originalPrice: 'Giá niêm yết', discountPrice: 'Giá giảm',
  startAt: 'Bắt đầu', endAt: 'Kết thúc', createdAt: 'Ngày tạo', updatedAt: 'Cập nhật lúc',
  enabled: 'Trạng thái', active: 'Kích hoạt', status: 'Trạng thái',
  soldQuantity: 'Đã bán', quantityLimit: 'Giới hạn số lượng',
  remainingQuantity: 'Còn lại', maxPerCustomer: 'Tối đa / khách',
  minQuantity: 'Số lượng tối thiểu', quantity: 'Số lượng',
  name: 'Tên', productName: 'Tên sản phẩm', variantName: 'Tên phân loại',
  sku: 'Mã SKU', description: 'Mô tả',
  requiredPaymentMethodCode: 'Phương thức thanh toán', paymentMethod: 'Phương thức thanh toán',
  fullName: 'Họ tên', email: 'Email', phone: 'Số điện thoại',
  username: 'Tên đăng nhập', roleCode: 'Chức vụ',
  categoryName: 'Danh mục', brandName: 'Thương hiệu',
  note: 'Ghi chú', id: 'ID', productVariantId: 'ID phân loại', productId: 'ID sản phẩm',
};

const PRICE_FIELDS = new Set(['basePrice', 'salePrice', 'price', 'originalPrice', 'discountPrice']);
const DATE_FIELDS = new Set(['startAt', 'endAt', 'createdAt', 'updatedAt']);
const BOOL_FIELDS = new Set(['enabled', 'active']);
const ORDER_STATUS_MAP: Record<number, string> = {
  1: 'Chờ xác nhận', 2: 'Chờ lấy hàng', 3: 'Đang giao', 4: 'Hoàn thành', 5: 'Đã hủy',
};
const PAYMENT_LABELS: Record<string, string> = { VNPAY: 'VNPay', COD: 'Tiền mặt (COD)', '': 'Tất cả' };

function formatFieldValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (PRICE_FIELDS.has(key)) return typeof val === 'number' ? formatPrice(val) : String(val);
  if (DATE_FIELDS.has(key)) return fmtDateTime(String(val));
  if (BOOL_FIELDS.has(key)) return val ? '✅ Bật' : '❌ Tắt';
  if (key === 'status') return ORDER_STATUS_MAP[val as number] ?? `Trạng thái ${val}`;
  if (key === 'requiredPaymentMethodCode' || key === 'paymentMethod')
    return PAYMENT_LABELS[String(val)] ?? (String(val) || 'Tất cả');
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'number' && key.toLowerCase().includes('price')) return formatPrice(val);
  return String(val);
}

const SKIP_ON_UPDATE = new Set(['id', 'createdAt', 'updatedAt', 'soldQuantity']);

function SnapshotDiff({ action, before, after }: { action?: string; before?: string; after?: string }) {
  if (!before && !after) return null;

  let bObj: Record<string, unknown> = {};
  let aObj: Record<string, unknown> = {};
  try { if (before) bObj = JSON.parse(before); } catch { }
  try { if (after) aObj = JSON.parse(after); } catch { }

  const allKeys = Array.from(new Set([...Object.keys(bObj), ...Object.keys(aObj)]));
  const isCreate = action === 'CREATE';
  const isDelete = action === 'DELETE';

  type Row = { key: string; label: string; bv: string; av: string; changed: boolean };
  const rows: Row[] = allKeys
    .filter((k) => !(SKIP_ON_UPDATE.has(k) && !isCreate && !isDelete))
    .map((key) => {
      const bv = formatFieldValue(key, bObj[key]);
      const av = formatFieldValue(key, aObj[key]);
      return { key, label: FIELD_LABELS[key] ?? key, bv, av, changed: bv !== av };
    })
    .sort((a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0));

  if (rows.length === 0) return null;

  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--bg-border)]">
      <div className="flex items-center gap-2 border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {isCreate ? 'Thông tin đã tạo' : isDelete ? 'Thông tin đã xóa' : 'So sánh thay đổi'}
        </span>
        {!isCreate && !isDelete && changedCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            {changedCount} trường thay đổi
          </span>
        )}
      </div>

      <div className="divide-y divide-[var(--bg-border)]">
        {rows.map(({ key, label, bv, av, changed }) => (
          <div
            key={key}
            className={clsx(
              'grid items-center gap-3 px-4 py-2.5 text-xs',
              isCreate || isDelete ? 'grid-cols-[140px_1fr]' : 'grid-cols-[140px_1fr_16px_1fr]',
              changed && !isCreate && !isDelete && 'bg-[var(--accent)]/[0.04]'
            )}
          >
            <span className={clsx('font-semibold truncate', changed && !isCreate && !isDelete ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')}>
              {label}
            </span>
            {isCreate ? (
              <span className="text-[var(--text-primary)]">{av}</span>
            ) : isDelete ? (
              <span className="text-[var(--danger)] line-through">{bv}</span>
            ) : (
              <>
                <span className={clsx(changed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-secondary)]')}>
                  {bv}
                </span>
                <span className="text-center text-[var(--text-muted)]">→</span>
                <span className={clsx('font-semibold', changed ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                  {av}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onClear, hasFilters }: { onClear: () => void; hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--bg-border)] bg-[var(--bg-surface)] p-12 text-center">
      <Clock className="mx-auto mb-3 size-8 text-[var(--text-muted)]" aria-hidden />
      <p className="text-sm text-[var(--text-muted)]">Không có bản ghi nào.</p>
      {hasFilters && (
        <button onClick={onClear} className="mt-3 text-xs text-[var(--accent)] underline-offset-2 hover:underline">
          Xóa bộ lọc để xem tất cả
        </button>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({ page, totalPages, pagination, itemCount, onPrev, onNext }: {
  page: number; totalPages: number; pagination: any;
  itemCount: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-[var(--text-muted)]">
        {pagination
          ? `Tổng ${pagination.totalElements.toLocaleString('vi-VN')} bản ghi · Trang ${page + 1} / ${pagination.totalPages}`
          : `Trang ${page + 1}`}
      </p>
      <div className="flex items-center gap-1.5">
        <button disabled={page === 0} onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40">
          <ChevronLeft className="size-3.5" aria-hidden />Trước
        </button>
        <button disabled={page + 1 >= totalPages || itemCount < PAGE_SIZE} onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40">
          Tiếp<ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ─── Unified detail drawer ────────────────────────────────────────────────────

function UnifiedDetailDrawer({ item, onClose }: { item: UnifiedHistoryResponse; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--bg-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <History className="size-4 text-[var(--accent)]" aria-hidden />
            <h2 className="font-[family-name:var(--font-admin-heading)] text-sm font-semibold text-[var(--text-primary)]">
              Chi tiết lịch sử #{item.id}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={sourceTone(item.source)} label={sourceLabel(item.source)} />
            <StatusBadge tone={actionTone(item.action)} label={ACTION_LABELS[item.action] ?? item.action} />
            <StatusBadge tone="neutral" label={ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType} />
          </div>

          <dl className="divide-y divide-[var(--bg-border)] text-sm">
            {[
              { label: 'Thời gian', value: fmtDateTime(item.createdAt) },
              { label: 'Người thực hiện', value: item.actorFullName ?? item.actorUsername ?? '—' },
              { label: 'Username', value: item.actorUsername ?? '—' },
              { label: 'IP', value: item.ipAddress ?? '—' },
              { label: 'Đối tượng', value: item.entityLabel ? `${item.entityLabel} (id=${item.entityId})` : item.entityId ? `id=${item.entityId}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3 py-2.5">
                <dt className="w-36 shrink-0 text-xs font-semibold text-[var(--text-muted)]">{label}</dt>
                <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Thay đổi trạng thái đơn hàng */}
          {item.action === 'ORDER_STATUS' && (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Thay đổi trạng thái đơn hàng</p>
              <div className="flex items-center gap-3">
                <StatusBadge tone="neutral" label={item.oldStatusLabel ?? `Trạng thái ${item.oldStatus}`} />
                <span className="text-sm text-[var(--text-muted)]">→</span>
                <StatusBadge tone="success" label={item.newStatusLabel ?? `Trạng thái ${item.newStatus}`} />
              </div>
              {item.note && <p className="mt-3 text-xs text-[var(--text-secondary)]"><span className="font-semibold">Ghi chú:</span> {item.note}</p>}
            </div>
          )}

          {/* Thay đổi hoàn / trả */}
          {item.action === 'RETURN_REFUND_STATUS' && (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Thay đổi trạng thái hoàn / trả</p>
              <div className="flex items-center gap-3">
                <StatusBadge tone="neutral" label={item.oldReturnRefundStatusLabel ?? `Trạng thái ${item.oldReturnRefundStatus}`} />
                <span className="text-sm text-[var(--text-muted)]">→</span>
                <StatusBadge tone="warning" label={item.newReturnRefundStatusLabel ?? `Trạng thái ${item.newReturnRefundStatus}`} />
              </div>
              {item.note && <p className="mt-3 text-xs text-[var(--text-secondary)]"><span className="font-semibold">Ghi chú:</span> {item.note}</p>}
            </div>
          )}

          <SnapshotDiff action={item.action} before={item.snapshotBefore} after={item.snapshotAfter} />
        </div>
      </aside>
    </div>
  );
}

// ─── Price event detail drawer ────────────────────────────────────────────────

function PriceEventDetailDrawer({ item, onClose }: { item: PriceEventHistoryResponse; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--bg-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CircleDollarSign className="size-4 text-[var(--accent)]" aria-hidden />
            <h2 className="font-[family-name:var(--font-admin-heading)] text-sm font-semibold text-[var(--text-primary)]">
              Chi tiết sự kiện giá #{item.id}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={programTypeTone(item.programType)} label={PROGRAM_TYPE_LABELS[item.programType] ?? item.programType} />
            <StatusBadge tone={priceEventTone(item.eventType)} label={item.eventTypeLabel ?? PRICE_EVENT_TYPE_LABELS[item.eventType] ?? item.eventType} />
          </div>

          <dl className="divide-y divide-[var(--bg-border)] text-sm">
            {[
              { label: 'Thời gian', value: fmtDateTime(item.createdAt) },
              { label: 'Chương trình', value: `#${item.programId}` },
              { label: 'Product ID', value: item.productId ? `#${item.productId}` : '—' },
              { label: 'Variant ID', value: item.productVariantId ? `#${item.productVariantId}` : '—' },
              { label: 'Người thực hiện', value: item.actorFullName ?? item.actorUsername ?? 'SYSTEM' },
              { label: 'Username', value: item.actorUsername ?? '—' },
              { label: 'Hiệu lực từ', value: fmtDateTime(item.programStartAt) },
              { label: 'Hiệu lực đến', value: fmtDateTime(item.programEndAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3 py-2.5">
                <dt className="w-36 shrink-0 text-xs font-semibold text-[var(--text-muted)]">{label}</dt>
                <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Bảng so sánh giá trước / sau */}
          {(item.oldSalePrice != null || item.newSalePrice != null ||
            item.oldBasePrice != null || item.newBasePrice != null ||
            item.oldQuantityLimit != null || item.newQuantityLimit != null) && (
              <div className="overflow-hidden rounded-xl border border-[var(--bg-border)]">
                <div className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  So sánh trước / sau
                </div>
                <div className="divide-y divide-[var(--bg-border)]">
                  {[
                    { label: 'Giá gốc', old: item.oldBasePrice, new: item.newBasePrice, fmt: formatPrice },
                    { label: 'Giá ưu đãi', old: item.oldSalePrice, new: item.newSalePrice, fmt: formatPrice },
                    { label: 'Quota', old: item.oldQuantityLimit, new: item.newQuantityLimit, fmt: (v: number) => `${v.toLocaleString('vi-VN')} sản phẩm` },
                  ].filter((r) => r.old != null || r.new != null).map(({ label, old: ov, new: nv, fmt }) => {
                    const changed = ov !== nv;
                    return (
                      <div key={label} className={clsx('grid grid-cols-[140px_1fr_16px_1fr] items-center gap-3 px-4 py-2.5 text-xs', changed && 'bg-[var(--accent)]/[0.04]')}>
                        <span className={clsx('font-semibold', changed ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')}>{label}</span>
                        <span className={clsx(changed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-secondary)]')}>
                          {ov != null ? fmt(ov) : '—'}
                        </span>
                        <span className="text-center text-[var(--text-muted)]">→</span>
                        <span className={clsx('font-semibold', changed ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                          {nv != null ? fmt(nv) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {item.note && (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ghi chú thay đổi</p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.note}</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Filter label helper ──────────────────────────────────────────────────────

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'h-8 w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminHistoryPage() {
  // ── Nguồn đang chọn ────────────────────────────────────────────────────
  const [source, setSource] = useState<SourceKey>('ALL');

  // ── Filter unified ──────────────────────────────────────────────────────
  const [uEntityType, setUEntityType] = useState('');
  const [uAction, setUAction] = useState('');
  const [uRole, setURole] = useState('');
  const [uFrom, setUFrom] = useState('');
  const [uTo, setUTo] = useState('');
  const [uKeyword, setUKeyword] = useState('');

  // ── Filter price ────────────────────────────────────────────────────────
  const [pProgramType, setPProgramType] = useState('');
  const [pEventType, setPEventType] = useState('');
  const [pFrom, setPFrom] = useState('');
  const [pTo, setPTo] = useState('');
  const [pKeyword, setPKeyword] = useState('');

  // ── Phân trang ──────────────────────────────────────────────────────────
  const [uPage, setUPage] = useState(0);
  const [pPage, setPPage] = useState(0);

  // ── Selected item ────────────────────────────────────────────────────────
  const [uSelected, setUSelected] = useState<UnifiedHistoryResponse | null>(null);
  const [pSelected, setPSelected] = useState<PriceEventHistoryResponse | null>(null);

  const isPriceTab = source === 'PRICE';

  // ── Reset page khi source đổi ────────────────────────────────────────────
  const handleSource = (s: SourceKey) => { setSource(s); setUPage(0); setPPage(0); };

  // ── Derived: có filter active không ─────────────────────────────────────
  const uHasFilters = source !== 'ALL' || !!uEntityType || !!uAction || !!uRole || !!uFrom || !!uTo || !!uKeyword;
  const pHasFilters = !!pProgramType || !!pEventType || !!pFrom || !!pTo || !!pKeyword;

  const clearUnified = useCallback(() => {
    setUEntityType(''); setUAction(''); setURole('');
    setUFrom(''); setUTo(''); setUKeyword('');
    setSource('ALL'); setUPage(0);
  }, []);

  const clearPrice = useCallback(() => {
    setPProgramType(''); setPEventType('');
    setPFrom(''); setPTo(''); setPKeyword('');
    setPPage(0);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const uQuery = useQuery({
    queryKey: ['admin-history-unified', source, uEntityType, uAction, uRole, uFrom, uTo, uPage],
    queryFn: () => adminHistoryService.search({
      source: source !== 'ALL' && source !== 'PRICE' ? source : undefined,
      entityType: uEntityType || undefined,
      action: uAction || undefined,
      actorRoleCode: uRole || undefined,
      from: uFrom ? new Date(uFrom).toISOString() : undefined,
      to: uTo ? new Date(uTo).toISOString() : undefined,
      page: uPage, size: PAGE_SIZE,
    }),
    enabled: !isPriceTab,
    staleTime: 30_000,
  });

  const pQuery = useQuery({
    queryKey: ['admin-history-price', pProgramType, pEventType, pFrom, pTo, pPage],
    queryFn: () => adminHistoryService.searchPriceEvents({
      programType: pProgramType || undefined,
      eventType: pEventType || undefined,
      from: pFrom ? new Date(pFrom).toISOString() : undefined,
      to: pTo ? new Date(pTo).toISOString() : undefined,
      page: pPage, size: PAGE_SIZE,
    }),
    enabled: isPriceTab,
    staleTime: 30_000,
  });

  // ── Client keyword filter ────────────────────────────────────────────────
  const uAllItems = uQuery.data?.items ?? [];
  const uItems = uKeyword
    ? uAllItems.filter((r) =>
      (r.entityLabel ?? '').toLowerCase().includes(uKeyword.toLowerCase()) ||
      (r.actorUsername ?? '').toLowerCase().includes(uKeyword.toLowerCase()) ||
      (r.actorFullName ?? '').toLowerCase().includes(uKeyword.toLowerCase()))
    : uAllItems;

  const pAllItems = pQuery.data?.items ?? [];
  const pItems = pKeyword
    ? pAllItems.filter((r) =>
      String(r.productId ?? '').includes(pKeyword) ||
      String(r.programId ?? '').includes(pKeyword) ||
      (r.actorUsername ?? '').toLowerCase().includes(pKeyword.toLowerCase()) ||
      (r.actorFullName ?? '').toLowerCase().includes(pKeyword.toLowerCase()))
    : pAllItems;

  const uPagination = uQuery.data?.pagination;
  const pPagination = pQuery.data?.pagination;
  const uTotalPages = uPagination?.totalPages ?? (uItems.length < PAGE_SIZE ? uPage + 1 : uPage + 2);
  const pTotalPages = pPagination?.totalPages ?? (pItems.length < PAGE_SIZE ? pPage + 1 : pPage + 2);

  const activeQuery = isPriceTab ? pQuery : uQuery;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
            Lịch sử hệ thống
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tra cứu toàn bộ thao tác — đơn hàng, sản phẩm, danh mục, chương trình giá…
          </p>
        </div>
        <button
          onClick={() => activeQuery.refetch()}
          disabled={activeQuery.isFetching}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          <RefreshCw className={clsx('size-3.5', activeQuery.isFetching && 'animate-spin')} aria-hidden />
          Làm mới
        </button>
      </div>

      {/* ── Source pills ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {SOURCE_PILLS.map((pill) => (
          <button key={pill.value} onClick={() => handleSource(pill.value)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              source === pill.value
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
            )}>
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Filter panel ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 space-y-3 shadow-[var(--card-shadow)]">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          <Filter className="size-3.5" aria-hidden />Bộ lọc
          {(isPriceTab ? pHasFilters : uHasFilters) && (
            <button
              onClick={isPriceTab ? clearPrice : clearUnified}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--bg-border)] px-2 py-0.5 text-[10px] normal-case font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              <X className="size-3" />Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Hàng 1: Search + selects */}
        <div className="grid grid-cols-4 gap-3">
          {/* Search — chung cho cả 2 chế độ */}
          <FilterField label="Tìm kiếm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
              {isPriceTab ? (
                <input type="text" placeholder="Product ID, người dùng…" value={pKeyword}
                  onChange={(e) => { setPKeyword(e.target.value); setPPage(0); }}
                  className={clsx(inputCls, 'pl-8')} />
              ) : (
                <input type="text" placeholder="Entity, người dùng…" value={uKeyword}
                  onChange={(e) => { setUKeyword(e.target.value); setUPage(0); }}
                  className={clsx(inputCls, 'pl-8')} />
              )}
            </div>
          </FilterField>

          {/* Selects tùy theo chế độ */}
          {isPriceTab ? (
            <>
              <FilterField label="Loại chương trình">
                <select value={pProgramType} onChange={(e) => { setPProgramType(e.target.value); setPPage(0); }} className={inputCls}>
                  <option value="">Tất cả</option>
                  {PROGRAM_TYPES_DATA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Sự kiện">
                <select value={pEventType} onChange={(e) => { setPEventType(e.target.value); setPPage(0); }} className={inputCls}>
                  <option value="">Tất cả</option>
                  {PRICE_EVENT_TYPES_DATA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
              <div /> {/* cột trống */}
            </>
          ) : (
            <>
              <FilterField label="Loại entity">
                <select value={uEntityType} onChange={(e) => { setUEntityType(e.target.value); setUPage(0); }} className={inputCls}>
                  <option value="">Tất cả</option>
                  {ENTITY_TYPES_DATA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Hành động">
                <select value={uAction} onChange={(e) => { setUAction(e.target.value); setUPage(0); }} className={inputCls}>
                  <option value="">Tất cả</option>
                  {ACTIONS_DATA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Chức vụ">
                <select value={uRole} onChange={(e) => { setURole(e.target.value); setUPage(0); }} className={inputCls}>
                  <option value="">Tất cả</option>
                  {ROLES_DATA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
            </>
          )}
        </div>

        {/* Hàng 2: Khoảng thời gian */}
        <div className="grid grid-cols-4 gap-3">
          <FilterField label="Từ ngày">
            <input type="datetime-local"
              value={isPriceTab ? pFrom : uFrom}
              onChange={(e) => isPriceTab ? (setPFrom(e.target.value), setPPage(0)) : (setUFrom(e.target.value), setUPage(0))}
              className={inputCls} />
          </FilterField>
          <FilterField label="Đến ngày">
            <input type="datetime-local"
              value={isPriceTab ? pTo : uTo}
              onChange={(e) => isPriceTab ? (setPTo(e.target.value), setPPage(0)) : (setUTo(e.target.value), setUPage(0))}
              className={inputCls} />
          </FilterField>
          <div /><div />
        </div>
      </div>

      {/* ── Loading / error ─────────────────────────────────────────────────── */}
      {activeQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-sm text-[var(--text-muted)]">
          <Loader2 className="size-5 animate-spin text-[var(--accent)]" aria-hidden />Đang tải…
        </div>
      ) : activeQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {activeQuery.error instanceof Error ? activeQuery.error.message : 'Lỗi tải dữ liệu.'}
        </div>
      ) : isPriceTab ? (
        /* ════════════════════════ BẢNG LỊCH SỬ GIÁ ════════════════════════ */
        pItems.length === 0 ? (
          <EmptyState onClear={clearPrice} hasFilters={pHasFilters} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Chương trình</th>
                      <th className="px-4 py-3">Sự kiện</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Giá ưu đãi</th>
                      <th className="px-4 py-3">Quota</th>
                      <th className="px-4 py-3">Người thực hiện</th>
                      <th className="px-4 py-3">Ghi chú</th>
                      <th className="px-4 py-3 text-center">Xem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bg-border)]">
                    {pItems.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-[var(--bg-elevated)]/30">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{fmtDateTime(item.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge tone={programTypeTone(item.programType)} label={item.programTypeLabel ?? PROGRAM_TYPE_LABELS[item.programType] ?? item.programType} />
                            <span className="font-mono text-[11px] text-[var(--text-muted)]">#{item.programId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={priceEventTone(item.eventType)} label={item.eventTypeLabel ?? PRICE_EVENT_TYPE_LABELS[item.eventType] ?? item.eventType} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {item.productId ? `#${item.productId}` : '—'}
                          {item.productVariantId && <span className="block text-[var(--text-muted)]">var #{item.productVariantId}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {(item.oldSalePrice != null || item.newSalePrice != null) ? (
                            <div className="flex flex-col gap-0.5">
                              {item.oldSalePrice != null && <span className="text-[var(--text-muted)] line-through">{formatPrice(item.oldSalePrice)}</span>}
                              {item.newSalePrice != null && <span className="font-semibold text-[var(--accent)]">{formatPrice(item.newSalePrice)}</span>}
                            </div>
                          ) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {(item.oldQuantityLimit != null || item.newQuantityLimit != null) ? (
                            <div className="flex items-center gap-1">
                              {item.oldQuantityLimit != null && <span className="text-[var(--text-muted)]">{item.oldQuantityLimit}</span>}
                              {item.oldQuantityLimit != null && item.newQuantityLimit != null && <span className="text-[var(--text-muted)]">→</span>}
                              {item.newQuantityLimit != null && <span className="font-semibold text-[var(--text-primary)]">{item.newQuantityLimit}</span>}
                            </div>
                          ) : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[var(--text-primary)]">{item.actorFullName ?? item.actorUsername ?? 'SYSTEM'}</span>
                            {item.actorFullName && item.actorUsername && <span className="text-[var(--text-muted)]">@{item.actorUsername}</span>}
                          </div>
                        </td>
                        <td className="max-w-[180px] px-4 py-3">
                          {item.note ? <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">{item.note}</p> : <span className="text-xs text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setPSelected(item)} className="inline-flex rounded-lg border border-[var(--bg-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]">Xem</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <PaginationBar page={pPage} totalPages={pTotalPages} pagination={pPagination} itemCount={pItems.length} onPrev={() => setPPage((p) => Math.max(0, p - 1))} onNext={() => setPPage((p) => p + 1)} />
          </>
        )
      ) : (
        /* ════════════════════ BẢNG UNIFIED HISTORY ════════════════════════ */
        uItems.length === 0 ? (
          <EmptyState onClear={clearUnified} hasFilters={uHasFilters} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Nguồn</th>
                      <th className="px-4 py-3">Hành động</th>
                      <th className="px-4 py-3">Đối tượng</th>
                      <th className="px-4 py-3">Người thực hiện</th>
                      <th className="px-4 py-3">Chi tiết</th>
                      <th className="px-4 py-3 text-center">Xem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bg-border)]">
                    {uItems.map((item) => (
                      <tr key={`${item.source}-${item.id}`} className="transition-colors hover:bg-[var(--bg-elevated)]/30">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{fmtDateTime(item.createdAt)}</td>
                        <td className="px-4 py-3"><StatusBadge tone={sourceTone(item.source)} label={sourceLabel(item.source)} /></td>
                        <td className="px-4 py-3"><StatusBadge tone={actionTone(item.action)} label={ACTION_LABELS[item.action] ?? item.action} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}</span>
                            {item.entityLabel && <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.entityLabel}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-[var(--text-primary)]">{item.actorFullName ?? item.actorUsername ?? 'system'}</span>
                            {item.actorFullName && item.actorUsername && <span className="text-[11px] text-[var(--text-muted)]">@{item.actorUsername}</span>}
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          {item.action === 'ORDER_STATUS' && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[var(--text-muted)]">{item.oldStatusLabel ?? `#${item.oldStatus}`}</span>
                              <span className="text-[var(--text-muted)]">→</span>
                              <span className="font-semibold text-[var(--text-primary)]">{item.newStatusLabel ?? `#${item.newStatus}`}</span>
                            </div>
                          )}
                          {item.action === 'RETURN_REFUND_STATUS' && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[var(--text-muted)]">{item.oldReturnRefundStatusLabel ?? `#${item.oldReturnRefundStatus}`}</span>
                              <span className="text-[var(--text-muted)]">→</span>
                              <span className="font-semibold text-[var(--text-primary)]">{item.newReturnRefundStatusLabel ?? `#${item.newReturnRefundStatus}`}</span>
                            </div>
                          )}
                          {item.source === 'ACTIVITY_LOG' && (() => {
                            let bObj: Record<string, unknown> = {};
                            let aObj: Record<string, unknown> = {};
                            try { if (item.snapshotBefore) bObj = JSON.parse(item.snapshotBefore); } catch { }
                            try { if (item.snapshotAfter) aObj = JSON.parse(item.snapshotAfter); } catch { }
                            const PRICE_K = ['salePrice', 'basePrice', 'price'];
                            const changed = Object.keys({ ...bObj, ...aObj }).filter((k) => {
                              return formatFieldValue(k, bObj[k]) !== formatFieldValue(k, aObj[k])
                                && !['id', 'createdAt', 'updatedAt', 'soldQuantity'].includes(k);
                            });
                            const previewKey = PRICE_K.find((k) => changed.includes(k)) ?? changed[0];
                            if (!previewKey) return <span className="text-xs text-[var(--text-muted)]">—</span>;
                            const bv = formatFieldValue(previewKey, bObj[previewKey]);
                            const av = formatFieldValue(previewKey, aObj[previewKey]);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-semibold text-[var(--text-muted)]">{FIELD_LABELS[previewKey] ?? previewKey}</span>
                                {item.action === 'CREATE' ? (
                                  <span className="text-xs text-[var(--success)]">{av}</span>
                                ) : item.action === 'DELETE' ? (
                                  <span className="text-xs text-[var(--danger)] line-through">{bv}</span>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-[var(--text-muted)] line-through">{bv}</span>
                                    <span className="text-[var(--text-muted)]">→</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{av}</span>
                                  </div>
                                )}
                                {changed.length > 1 && (
                                  <span className="text-[10px] text-[var(--text-muted)]">+{changed.length - 1} trường khác</span>
                                )}
                              </div>
                            );
                          })()}
                          {item.note && <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">{item.note}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setUSelected(item)} className="inline-flex rounded-lg border border-[var(--bg-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]">Xem</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <PaginationBar page={uPage} totalPages={uTotalPages} pagination={uPagination} itemCount={uItems.length} onPrev={() => setUPage((p) => Math.max(0, p - 1))} onNext={() => setUPage((p) => p + 1)} />
          </>
        )
      )}

      {/* ── Drawers ──────────────────────────────────────────────────────────── */}
      {uSelected && <UnifiedDetailDrawer item={uSelected} onClose={() => setUSelected(null)} />}
      {pSelected && <PriceEventDetailDrawer item={pSelected} onClose={() => setPSelected(null)} />}
    </div>
  );
}

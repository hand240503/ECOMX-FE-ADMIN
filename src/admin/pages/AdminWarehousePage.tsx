import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Loader2, Search, PackagePlus, SlidersHorizontal, History, RefreshCw, Boxes } from 'lucide-react';
import { adminInventoryService } from '../../api/services/adminInventoryService';
import type {
  InventoryStockResponse,
  InventoryLedgerResponse,
  InventoryMovementType,
} from '../../api/types/inventory.types';
import { notify } from '../../utils/notify';
import { getApiErrorMessage } from '../../utils/apiError';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';

const LOW_STOCK_THRESHOLD = 5;

const MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  IMPORT: 'Nhập kho',
  ADJUST: 'Điều chỉnh',
  RESERVE: 'Giữ hàng',
  RELEASE: 'Nhả giữ',
  SALE_OUT: 'Xuất bán',
  RETURN_IN: 'Nhập trả',
  RETURN_SCRAP: 'Hàng lỗi',
};

function optionsLabel(opts?: Record<string, string> | null): string {
  if (!opts) return '';
  const entries = Object.entries(opts);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ');
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}

const inputCls =
  'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' | 'accent' }) {
  return (
    <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--card-shadow)]">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p
        className={clsx(
          'mt-1 font-[family-name:var(--font-admin-mono)] text-lg font-semibold',
          tone === 'danger' ? 'text-[var(--danger)]' : tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Modal lịch sử biến động kho của một biến thể. */
function LedgerModal({ variant, onClose }: { variant: InventoryStockResponse; onClose: () => void }) {
  const ledgerQuery = useQuery({
    queryKey: ['admin-inventory-ledger', variant.variantId],
    queryFn: ({ signal }) => adminInventoryService.getLedger(variant.variantId, signal),
  });

  const rows: InventoryLedgerResponse[] = ledgerQuery.data ?? [];

  return (
    <AddFormShell
      presentation="modal"
      open
      title={`Lịch sử kho · ${variant.productName ?? ''} (SKU ${variant.skuCode ?? variant.variantId})`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          Đóng
        </button>
      }
    >
      {ledgerQuery.isLoading ? (
        <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Đang tải…</p>
      ) : ledgerQuery.isError ? (
        <p className="py-6 text-center text-sm text-[var(--danger)]">
          {getApiErrorMessage(ledgerQuery.error, 'Không tải được lịch sử')}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">Chưa có biến động kho nào.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-lg border border-[var(--bg-border)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                <th className="px-3 py-2 font-semibold">Thời gian</th>
                <th className="px-3 py-2 font-semibold">Loại</th>
                <th className="px-3 py-2 text-right font-semibold">SL</th>
                <th className="px-3 py-2 text-right font-semibold">Tồn trước</th>
                <th className="px-3 py-2 text-right font-semibold">Tồn sau</th>
                <th className="px-3 py-2 font-semibold">Đơn / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--bg-border)]/70">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">{formatTimestamp(r.createdDate)}</td>
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{MOVEMENT_LABEL[r.movementType] ?? r.movementType}</td>
                  <td
                    className={clsx(
                      'px-3 py-2 text-right font-[family-name:var(--font-admin-mono)]',
                      r.quantity > 0 ? 'text-[var(--accent)]' : r.quantity < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
                    )}
                  >
                    {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                  </td>
                  <td className="px-3 py-2 text-right font-[family-name:var(--font-admin-mono)] text-[var(--text-secondary)]">{r.sumBegin ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]">{r.sumEnd ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {r.orderDetailId ? <span className="mr-1 text-[11px] text-[var(--text-muted)]">#OD{r.orderDetailId}</span> : null}
                    {r.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AddFormShell>
  );
}

type ActionKind = 'import' | 'adjust';

export default function AdminWarehousePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  // Modal nhập/điều chỉnh
  const [action, setAction] = useState<ActionKind | null>(null);
  const [target, setTarget] = useState<InventoryStockResponse | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal lịch sử
  const [ledgerTarget, setLedgerTarget] = useState<InventoryStockResponse | null>(null);

  const stocksQuery = useQuery({
    queryKey: ['admin-inventory-stocks'],
    queryFn: ({ signal }) => adminInventoryService.listStocks(undefined, signal),
    staleTime: 30_000,
  });

  const all = useMemo(() => stocksQuery.data ?? [], [stocksQuery.data]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        (s.productName ?? '').toLowerCase().includes(q) ||
        (s.skuCode ?? '').toLowerCase().includes(q) ||
        optionsLabel(s.optionValues).toLowerCase().includes(q)
    );
  }, [all, filter]);

  const stats = useMemo(() => {
    let onHand = 0;
    let reserved = 0;
    let low = 0;
    for (const s of all) {
      onHand += s.onHand ?? 0;
      reserved += s.reserved ?? 0;
      if ((s.available ?? 0) <= LOW_STOCK_THRESHOLD) low += 1;
    }
    return { skus: all.length, onHand, reserved, low };
  }, [all]);

  const openAction = useCallback((kind: ActionKind, row: InventoryStockResponse) => {
    setAction(kind);
    setTarget(row);
    setQtyInput(kind === 'adjust' ? String(row.onHand ?? 0) : '');
    setNoteInput('');
  }, []);

  const closeAction = useCallback(() => {
    setAction(null);
    setTarget(null);
    setQtyInput('');
    setNoteInput('');
  }, []);

  const onSubmitAction = useCallback(async () => {
    if (!action || !target) return;
    const value = Number(qtyInput);
    if (!Number.isFinite(value) || (action === 'import' && value <= 0) || (action === 'adjust' && value < 0)) {
      notify.error(action === 'import' ? 'Số lượng nhập phải lớn hơn 0' : 'Tồn kho không được âm');
      return;
    }
    setSaving(true);
    try {
      if (action === 'import') {
        await adminInventoryService.importStock({ variantId: target.variantId, quantity: value, note: noteInput.trim() || undefined });
        notify.success('Đã nhập kho');
      } else {
        await adminInventoryService.adjustStock({ variantId: target.variantId, onHand: value, note: noteInput.trim() || undefined });
        notify.success('Đã điều chỉnh tồn kho');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory-stocks'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory-ledger', target.variantId] });
      closeAction();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Thao tác thất bại'));
    } finally {
      setSaving(false);
    }
  }, [action, target, qtyInput, noteInput, queryClient, closeAction]);

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Quản lý kho (Tồn kho theo biến thể)"
        subtitle="Tồn kho được tính theo từng biến thể (SKU). Có thể bán = Tồn − Đang giữ."
      />

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Số SKU" value={stats.skus} />
        <StatCard label="Tổng tồn (on-hand)" value={stats.onHand} />
        <StatCard label="Đang giữ (reserved)" value={stats.reserved} tone="accent" />
        <StatCard label={`Sắp hết (≤ ${LOW_STOCK_THRESHOLD})`} value={stats.low} tone="danger" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm sản phẩm / SKU</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, SKU hoặc thuộc tính…"
            className={clsx(inputCls, 'w-full pl-9')}
          />
        </label>
        <button
          type="button"
          onClick={() => void stocksQuery.refetch()}
          disabled={stocksQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          <RefreshCw className={clsx('size-3.5', stocksQuery.isFetching && 'animate-spin')} aria-hidden />
          Làm mới
        </button>
        <p className="text-[11px] text-[var(--text-muted)]">{all.length} SKU</p>
      </div>

      {/* Bảng tồn kho */}
      {stocksQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">Đang tải…</div>
      ) : stocksQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(stocksQuery.error, 'Không tải được tồn kho')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          {filter ? 'Không có SKU khớp bộ lọc.' : 'Chưa có biến thể nào. Hãy tạo sản phẩm và biến thể trước.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Thuộc tính</th>
                  <th className="px-4 py-3 text-right font-semibold">Tồn</th>
                  <th className="px-4 py-3 text-right font-semibold">Đang giữ</th>
                  <th className="px-4 py-3 text-right font-semibold">Có thể bán</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const low = (s.available ?? 0) <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={s.variantId} className="border-b border-[var(--bg-border)]/80 hover:bg-[var(--bg-elevated)]/40">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{s.productName ?? `#${s.productId ?? ''}`}</td>
                      <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-secondary)]">{s.skuCode ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{optionsLabel(s.optionValues) || '—'}</td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]">{s.onHand}</td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-admin-mono)] text-[var(--text-secondary)]">{s.reserved}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={clsx(
                            'inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-0.5 font-[family-name:var(--font-admin-mono)] text-xs font-semibold',
                            low ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          )}
                          title={low ? 'Sắp hết hàng' : undefined}
                        >
                          {s.available}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAction('import', s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            <PackagePlus className="size-3.5" aria-hidden /> Nhập
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction('adjust', s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            <SlidersHorizontal className="size-3.5" aria-hidden /> Điều chỉnh
                          </button>
                          <button
                            type="button"
                            onClick={() => setLedgerTarget(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                          >
                            <History className="size-3.5" aria-hidden /> Lịch sử
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nhập / điều chỉnh */}
      <AddFormShell
        presentation="modal"
        open={action != null && target != null}
        title={
          action === 'import'
            ? `Nhập kho · ${target?.productName ?? ''}`
            : `Điều chỉnh tồn · ${target?.productName ?? ''}`
        }
        onClose={closeAction}
        footer={
          <>
            <button
              type="button"
              onClick={() => void onSubmitAction()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {saving ? 'Đang lưu…' : action === 'import' ? 'Nhập kho' : 'Lưu điều chỉnh'}
            </button>
            <button
              type="button"
              onClick={closeAction}
              className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Huỷ
            </button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <Boxes className="size-4 text-[var(--text-muted)]" aria-hidden />
              <span>
                SKU <b className="text-[var(--text-primary)]">{target.skuCode ?? target.variantId}</b> · Tồn hiện tại{' '}
                <b className="text-[var(--text-primary)]">{target.onHand}</b> · Đang giữ {target.reserved} · Có thể bán {target.available}
              </span>
            </div>

            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              {action === 'import' ? 'Số lượng nhập thêm' : 'Tồn kho mới (on-hand)'}
              <span className="font-normal text-[var(--danger)]">*</span>
              <input
                type="number"
                min={action === 'import' ? 1 : 0}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Ghi chú (tuỳ chọn)
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={2}
                placeholder={action === 'import' ? 'VD: Nhập từ NCC ABC, phiếu PN-001…' : 'VD: Kiểm kê cuối tháng, hàng hư hỏng…'}
                className={inputCls}
              />
            </label>

            {action === 'adjust' && (
              <p className="text-[11px] text-[var(--text-muted)]">
                Điều chỉnh sẽ đặt thẳng tồn kho về giá trị mới (không cộng dồn). Dùng cho kiểm kê.
              </p>
            )}
          </div>
        )}
      </AddFormShell>

      {/* Modal lịch sử */}
      {ledgerTarget && <LedgerModal variant={ledgerTarget} onClose={() => setLedgerTarget(null)} />}
    </div>
  );
}

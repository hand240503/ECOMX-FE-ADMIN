import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Loader2, Search, PackagePlus, SlidersHorizontal, History, RefreshCw, Boxes, UploadCloud,
  Store as StoreIcon, Plus, ArrowLeftRight, X,
} from 'lucide-react';
import { adminInventoryService } from '../../api/services/adminInventoryService';
import { adminStoreService } from '../../api/services/adminStoreService';
import { AdminBulkImportModal } from '../components/AdminBulkImportModal';
import type {
  InventoryStockResponse,
  InventoryLedgerResponse,
  InventoryMovementType,
} from '../../api/types/inventory.types';
import type { StoreResponse } from '../../api/types/store.types';
import { notify } from '../../utils/notify';
import { getApiErrorMessage } from '../../utils/apiError';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
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
  TRANSFER_OUT: 'Chuyển đi',
  TRANSFER_IN: 'Nhận chuyển',
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

const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50';
const ghostBtn =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50';

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

/** Modal lịch sử biến động kho của một biến thể tại một kho. */
function LedgerModal({ storeId, variant, onClose }: { storeId: number; variant: InventoryStockResponse; onClose: () => void }) {
  const ledgerQuery = useQuery({
    queryKey: ['admin-inventory-ledger', storeId, variant.variantId],
    queryFn: ({ signal }) => adminInventoryService.getLedger(storeId, variant.variantId, signal),
  });
  const rows: InventoryLedgerResponse[] = ledgerQuery.data ?? [];
  return (
    <AddFormShell
      presentation="modal"
      open
      title={`Lịch sử kho · ${variant.productName ?? ''} (SKU ${variant.skuCode ?? variant.variantId})`}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
          Đóng
        </button>
      }
    >
      {ledgerQuery.isLoading ? (
        <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Đang tải…</p>
      ) : ledgerQuery.isError ? (
        <p className="py-6 text-center text-sm text-[var(--danger)]">{getApiErrorMessage(ledgerQuery.error, 'Không tải được lịch sử')}</p>
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
                  <td className={clsx('px-3 py-2 text-right font-[family-name:var(--font-admin-mono)]', r.quantity > 0 ? 'text-[var(--accent)]' : r.quantity < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>
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

/** Modal chuyển hàng giữa hai kho. */
function TransferModal({ stores, fromStoreId, stocks, onClose, onDone }: {
  stores: StoreResponse[];
  fromStoreId: number;
  stocks: InventoryStockResponse[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [from, setFrom] = useState<number>(fromStoreId);
  const [to, setTo] = useState<number>(() => stores.find((s) => s.id !== fromStoreId)?.id ?? 0);
  const [lines, setLines] = useState<Array<{ variantId: number; quantity: number; label: string; max: number }>>([]);
  const [pickVariant, setPickVariant] = useState<number>(0);
  const [pickQty, setPickQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fromIsCurrent = from === fromStoreId;
  const sourceStocks = fromIsCurrent ? stocks : [];

  const addLine = () => {
    if (!pickVariant) { notify.error('Chọn sản phẩm cần chuyển'); return; }
    const qty = Number(pickQty);
    if (!Number.isFinite(qty) || qty <= 0) { notify.error('Số lượng phải > 0'); return; }
    if (lines.some((l) => l.variantId === pickVariant)) { notify.error('Sản phẩm đã có trong phiếu'); return; }
    const s = sourceStocks.find((x) => x.variantId === pickVariant);
    const label = s ? `${s.productName ?? ''} (${s.skuCode ?? s.variantId})` : `#${pickVariant}`;
    const max = s?.available ?? 0;
    setLines((ls) => [...ls, { variantId: pickVariant, quantity: qty, label, max }]);
    setPickVariant(0); setPickQty('');
  };

  const submit = async () => {
    if (from === to) { notify.error('Kho nguồn và kho đích phải khác nhau'); return; }
    if (lines.length === 0) { notify.error('Thêm ít nhất 1 sản phẩm'); return; }
    setSaving(true);
    try {
      await adminStoreService.transfer({
        fromStoreId: from, toStoreId: to,
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        note: note.trim() || undefined,
      });
      notify.success('Chuyển kho thành công');
      onDone();
      onClose();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Chuyển kho thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AddFormShell
      presentation="modal"
      open
      title="Chuyển kho"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={() => void submit()} disabled={saving} className={primaryBtn}>
            {saving && <Loader2 className="size-3.5 animate-spin" />} Xác nhận chuyển
          </button>
          <button type="button" onClick={onClose} className={ghostBtn}>Huỷ</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Từ kho
            <select value={from} onChange={(e) => { setFrom(Number(e.target.value)); setLines([]); }} className={inputCls}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Đến kho
            <select value={to} onChange={(e) => setTo(Number(e.target.value))} className={inputCls}>
              {stores.filter((s) => s.id !== from).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        {!fromIsCurrent && (
          <p className="rounded-lg bg-[var(--bg-elevated)]/60 px-3 py-2 text-[11px] text-[var(--text-muted)]">
            Để chọn nhanh sản phẩm theo tồn, hãy chuyển từ kho đang xem. Bạn vẫn có thể nhập variantId thủ công bên dưới.
          </p>
        )}

        <div className="space-y-2 rounded-lg border border-[var(--bg-border)] p-3">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Thêm sản phẩm chuyển</p>
          <div className="flex flex-wrap items-end gap-2">
            {fromIsCurrent ? (
              <label className="flex flex-1 flex-col gap-1 text-[11px] text-[var(--text-secondary)]">Sản phẩm (SKU)
                <select value={pickVariant} onChange={(e) => setPickVariant(Number(e.target.value))} className={inputCls}>
                  <option value={0}>— Chọn —</option>
                  {sourceStocks.map((s) => (
                    <option key={s.variantId} value={s.variantId}>{(s.productName ?? '') + ' · ' + (s.skuCode ?? s.variantId) + ` (bán được ${s.available})`}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">variantId
                <input type="number" value={pickVariant || ''} onChange={(e) => setPickVariant(Number(e.target.value))} className={clsx(inputCls, 'w-32')} />
              </label>
            )}
            <label className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)]">Số lượng
              <input type="number" min={1} value={pickQty} onChange={(e) => setPickQty(e.target.value)} className={clsx(inputCls, 'w-28')} />
            </label>
            <button type="button" onClick={addLine} className={ghostBtn}><Plus className="size-3.5" /> Thêm</button>
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-[var(--bg-border)]/70 rounded-lg border border-[var(--bg-border)]">
              {lines.map((l) => (
                <li key={l.variantId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-[var(--text-primary)]">{l.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-admin-mono)] text-[var(--accent)]">×{l.quantity}</span>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))} className="text-[var(--danger)]"><X className="size-3.5" /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Ghi chú (tuỳ chọn)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} placeholder="VD: Điều chuyển bổ sung kho HN…" />
        </label>
      </div>
    </AddFormShell>
  );
}

type ActionKind = 'import' | 'adjust';

export default function AdminWarehousePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [storeId, setStoreId] = useState<number | null>(null);

  const [action, setAction] = useState<ActionKind | null>(null);
  const [target, setTarget] = useState<InventoryStockResponse | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [ledgerTarget, setLedgerTarget] = useState<InventoryStockResponse | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canUpdate = adminAccessControlUi.canUpdateStores();

  const storesQuery = useQuery({ queryKey: ['admin-stores'], queryFn: ({ signal }) => adminStoreService.list(undefined, signal) });
  const stores = useMemo(() => storesQuery.data ?? [], [storesQuery.data]);

  // Chọn kho mặc định khi danh sách kho sẵn sàng.
  useEffect(() => {
    if (storeId == null && stores.length > 0) {
      setStoreId(stores.find((s) => s.isDefault)?.id ?? stores[0].id);
    }
  }, [stores, storeId]);

  const stocksQuery = useQuery({
    queryKey: ['admin-inventory-stocks', storeId],
    queryFn: ({ signal }) => adminInventoryService.listStocks(storeId as number, undefined, signal),
    enabled: storeId != null,
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
    let onHand = 0, reserved = 0, low = 0;
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
  const closeAction = useCallback(() => { setAction(null); setTarget(null); setQtyInput(''); setNoteInput(''); }, []);

  const onSubmitAction = useCallback(async () => {
    if (!action || !target || storeId == null) return;
    const value = Number(qtyInput);
    if (!Number.isFinite(value) || (action === 'import' && value <= 0) || (action === 'adjust' && value < 0)) {
      notify.error(action === 'import' ? 'Số lượng nhập phải lớn hơn 0' : 'Tồn kho không được âm');
      return;
    }
    setSaving(true);
    try {
      if (action === 'import') {
        await adminInventoryService.importStock({ storeId, variantId: target.variantId, quantity: value, note: noteInput.trim() || undefined });
        notify.success('Đã nhập kho');
      } else {
        await adminInventoryService.adjustStock({ storeId, variantId: target.variantId, onHand: value, note: noteInput.trim() || undefined });
        notify.success('Đã điều chỉnh tồn kho');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory-stocks', storeId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory-ledger', storeId, target.variantId] });
      closeAction();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Thao tác thất bại'));
    } finally {
      setSaving(false);
    }
  }, [action, target, qtyInput, noteInput, queryClient, closeAction, storeId]);

  const currentStore = stores.find((s) => s.id === storeId) ?? null;

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Quản lý kho (Tồn kho đa kho)"
        subtitle="Tồn kho theo từng kho (store) và biến thể (SKU). Có thể bán = Tồn − Đang giữ."
      />

      {/* Chọn kho + quản lý */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <StoreIcon className="size-4 text-[var(--text-muted)]" aria-hidden />
          <span className="text-[var(--text-secondary)]">Kho:</span>
          <select
            value={storeId ?? ''}
            onChange={(e) => setStoreId(Number(e.target.value))}
            className={clsx(inputCls, 'min-w-[200px]')}
            disabled={stores.length === 0}
          >
            {stores.length === 0 && <option value="">— Chưa có kho —</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (mặc định)' : ''}{!s.active ? ' — ngừng' : ''}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && stores.length >= 2 && (
            <button type="button" onClick={() => setTransferOpen(true)} className={ghostBtn}><ArrowLeftRight className="size-3.5" /> Chuyển kho</button>
          )}
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          Chưa có kho nào. Vào trang “Cửa hàng (bản đồ)” để tạo kho đầu tiên.
        </div>
      ) : (
        <>
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
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm theo tên sản phẩm, SKU hoặc thuộc tính…" className={clsx(inputCls, 'w-full pl-9')} />
            </label>
            <button type="button" onClick={() => void stocksQuery.refetch()} disabled={stocksQuery.isFetching} className={ghostBtn}>
              <RefreshCw className={clsx('size-3.5', stocksQuery.isFetching && 'animate-spin')} aria-hidden /> Làm mới
            </button>
            {canUpdate && (
              <button type="button" onClick={() => setImportOpen(true)} className={primaryBtn}>
                <UploadCloud className="size-3.5" aria-hidden /> Nhập kho từ Excel
              </button>
            )}
            <p className="text-[11px] text-[var(--text-muted)]">{all.length} SKU · {currentStore?.name}</p>
          </div>

          {storeId != null && (
            <AdminBulkImportModal
              open={importOpen}
              onClose={() => setImportOpen(false)}
              title={`Nhập tồn kho — ${currentStore?.name ?? ''}`}
              subtitle="Cộng thêm (nhập kho) hoặc đặt tuyệt đối (kiểm kê) theo cột mode"
              importFn={(f) => adminInventoryService.importExcel(storeId, f)}
              templateFn={() => adminInventoryService.downloadImportTemplate()}
              templateFileName="mau_import_ton_kho.xlsx"
              createdLabel="Nhập thêm"
              updatedLabel="Kiểm kê"
              onImported={() => void stocksQuery.refetch()}
            />
          )}

          {/* Bảng tồn kho */}
          {stocksQuery.isLoading ? (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">Đang tải…</div>
          ) : stocksQuery.isError ? (
            <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">{getApiErrorMessage(stocksQuery.error, 'Không tải được tồn kho')}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
              {filter ? 'Không có SKU khớp bộ lọc.' : 'Kho này chưa có tồn. Hãy nhập kho cho từng SKU hoặc import Excel.'}
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
                            <span className={clsx('inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-0.5 font-[family-name:var(--font-admin-mono)] text-xs font-semibold', low ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]')} title={low ? 'Sắp hết hàng' : undefined}>
                              {s.available}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {canUpdate && (
                                <>
                                  <button type="button" onClick={() => openAction('import', s)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"><PackagePlus className="size-3.5" aria-hidden /> Nhập</button>
                                  <button type="button" onClick={() => openAction('adjust', s)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"><SlidersHorizontal className="size-3.5" aria-hidden /> Điều chỉnh</button>
                                </>
                              )}
                              <button type="button" onClick={() => setLedgerTarget(s)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--bg-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"><History className="size-3.5" aria-hidden /> Lịch sử</button>
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
        </>
      )}

      {/* Modal nhập / điều chỉnh */}
      <AddFormShell
        presentation="modal"
        open={action != null && target != null}
        title={action === 'import' ? `Nhập kho · ${target?.productName ?? ''}` : `Điều chỉnh tồn · ${target?.productName ?? ''}`}
        onClose={closeAction}
        footer={
          <>
            <button type="button" onClick={() => void onSubmitAction()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {saving ? 'Đang lưu…' : action === 'import' ? 'Nhập kho' : 'Lưu điều chỉnh'}
            </button>
            <button type="button" onClick={closeAction} className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">Huỷ</button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <Boxes className="size-4 text-[var(--text-muted)]" aria-hidden />
              <span>
                Kho <b className="text-[var(--text-primary)]">{currentStore?.name}</b> · SKU <b className="text-[var(--text-primary)]">{target.skuCode ?? target.variantId}</b> · Tồn{' '}
                <b className="text-[var(--text-primary)]">{target.onHand}</b> · Đang giữ {target.reserved} · Có thể bán {target.available}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              {action === 'import' ? 'Số lượng nhập thêm' : 'Tồn kho mới (on-hand)'} <span className="font-normal text-[var(--danger)]">*</span>
              <input type="number" min={action === 'import' ? 1 : 0} value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} className={inputCls} autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Ghi chú (tuỳ chọn)
              <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} rows={2} placeholder={action === 'import' ? 'VD: Nhập từ NCC ABC, phiếu PN-001…' : 'VD: Kiểm kê cuối tháng…'} className={inputCls} />
            </label>
            {action === 'adjust' && (<p className="text-[11px] text-[var(--text-muted)]">Điều chỉnh đặt thẳng tồn kho về giá trị mới (không cộng dồn). Dùng cho kiểm kê.</p>)}
          </div>
        )}
      </AddFormShell>

      {ledgerTarget && storeId != null && <LedgerModal storeId={storeId} variant={ledgerTarget} onClose={() => setLedgerTarget(null)} />}
      {transferOpen && storeId != null && (
        <TransferModal
          stores={stores.filter((s) => s.active)}
          fromStoreId={storeId}
          stocks={all}
          onClose={() => setTransferOpen(false)}
          onDone={() => { void stocksQuery.refetch(); }}
        />
      )}
    </div>
  );
}

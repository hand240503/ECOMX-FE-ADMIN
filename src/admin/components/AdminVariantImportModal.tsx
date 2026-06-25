import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  UploadCloud,
  Download,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { adminProductService } from '../../api/services/adminProductService';
import type { VariantImportResponse, ProductImportAction } from '../../api/types/product.types';

type Props = {
  open: boolean;
  productId: number | string;
  onClose: () => void;
  onImported?: () => void;
};

type Step = 'select' | 'review' | 'result';

function resolvePortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (document.querySelector('.admin-portal') as HTMLElement | null) ?? document.body;
}
const ACCEPT_EXT = ['.xlsx', '.xls', '.csv', '.txt'];

function isValidFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPT_EXT.some((ext) => lower.endsWith(ext));
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminVariantImportModal({ open, productId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<VariantImportResponse | null>(null);
  const [actions, setActions] = useState<Record<string, ProductImportAction>>({});
  const [result, setResult] = useState<VariantImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('select');
    setFile(null);
    setPreview(null);
    setActions({});
    setResult(null);
    setError(null);
    setPreviewing(false);
    setUploading(false);
    setDragOver(false);
  }, []);

  const busy = previewing || uploading;
  const handleClose = useCallback(() => {
    if (busy) return;
    reset();
    onClose();
  }, [busy, reset, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const pickFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    if (!isValidFile(f.name)) {
      setError('Chỉ chấp nhận file .xlsx, .xls, .csv hoặc .txt');
      return;
    }
    setFile(f);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await adminProductService.downloadVariantImportTemplate(productId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau_import_bien_the.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Không tải được file mẫu');
    } finally {
      setDownloading(false);
    }
  }, [productId]);

  // Bước 1 -> 2: phân tích & xem trước
  const handlePreview = useCallback(async () => {
    if (!file) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await adminProductService.previewImportVariants(productId, file);
      setPreview(res);
      const init: Record<string, ProductImportAction> = {};
      for (const r of res.results) {
        if (r.success && r.key) init[r.key] = (r.action as ProductImportAction) ?? 'CREATE';
      }
      setActions(init);
      setStep('review');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Xem trước thất bại';
      setError(msg);
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  }, [file, productId]);

  // Bước 2 -> 3: xác nhận import với lựa chọn
  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await adminProductService.importVariants(productId, file, actions);
      setResult(res);
      setStep('result');
      const ok = (res.createdCount ?? 0) + (res.updatedCount ?? 0);
      if (ok > 0) {
        toast.success(`Thêm mới ${res.createdCount ?? 0}, cập nhật ${res.updatedCount ?? 0} biến thể`);
        onImported?.();
      }
      if (res.failureCount > 0) toast.error(`${res.failureCount} biến thể lỗi`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import thất bại';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [file, productId, actions, onImported]);

  const setAction = useCallback((key: string, action: ProductImportAction) => {
    setActions((prev) => ({ ...prev, [key]: action }));
  }, []);

  const setAll = useCallback(
    (action: ProductImportAction) => {
      if (!preview) return;
      setActions((prev) => {
        const next = { ...prev };
        for (const r of preview.results) if (r.success && r.key) next[r.key] = action;
        return next;
      });
    },
    [preview]
  );

  const reviewRows = useMemo(() => (preview ? preview.results.filter((r) => r.success && r.key) : []), [preview]);
  const reviewFails = useMemo(() => (preview ? preview.results.filter((r) => !r.success) : []), [preview]);
  const chosenCreate = useMemo(() => Object.values(actions).filter((a) => a === 'CREATE').length, [actions]);
  const chosenUpdate = useMemo(() => Object.values(actions).filter((a) => a === 'UPDATE').length, [actions]);

  if (!open) return null;
  const portalTarget = resolvePortalTarget();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bg-border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Layers className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-admin-heading)] text-lg font-semibold leading-tight text-[var(--text-primary)]">
                Import biến thể
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {step === 'select' && 'Chọn file Excel biến thể → xem trước → thêm mới / cập nhật cho sản phẩm này'}
                {step === 'review' && 'Xem trước: chọn THÊM MỚI hoặc CẬP NHẬT cho từng biến thể'}
                {step === 'result' && 'Kết quả nạp biến thể'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* STEP 1: SELECT */}
          {step === 'select' && (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    File chỉ gồm cột <b className="text-[var(--text-primary)]">sku_code, option_values, sort_order,
                    active</b>. Biến thể đã có (khớp sku_code hoặc bộ thuộc tính) sẽ mặc định{' '}
                    <b className="text-[var(--text-primary)]">Cập nhật</b>, còn lại{' '}
                    <b className="text-[var(--text-primary)]">Thêm mới</b>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadTemplate()}
                  disabled={downloading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Tải file mẫu
                </button>
              </div>

              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--success)]/15 text-[var(--success)]">
                    <FileSpreadsheet className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatSize(file.size)}</p>
                  </div>
                  {!busy && (
                    <button
                      type="button"
                      onClick={clearFile}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      aria-label="Bỏ file"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={clsx(
                    'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all',
                    dragOver
                      ? 'scale-[1.01] border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)]/60'
                  )}
                >
                  <span
                    className={clsx(
                      'flex size-14 items-center justify-center rounded-full transition-colors',
                      dragOver ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    )}
                  >
                    <UploadCloud className="size-7" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Kéo thả file vào đây, hoặc bấm để chọn
                  </span>
                  <span className="flex flex-wrap items-center justify-center gap-1.5">
                    {ACCEPT_EXT.map((ext) => (
                      <span
                        key={ext}
                        className="rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--bg-border)]"
                      >
                        {ext}
                      </span>
                    ))}
                  </span>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_EXT.join(',')}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </>
          )}

          {/* STEP 2: REVIEW */}
          {step === 'review' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={<Layers className="size-4" />} label="Tổng biến thể" value={preview.totalVariants} tone="muted" />
                <StatCard icon={<Plus className="size-4" />} label="Thêm mới" value={chosenCreate} tone="accent" />
                <StatCard icon={<RefreshCw className="size-4" />} label="Cập nhật" value={chosenUpdate} tone="success" />
                <StatCard icon={<AlertTriangle className="size-4" />} label="Lỗi" value={reviewFails.length} tone="danger" />
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-secondary)]">Chọn hành động cho từng biến thể:</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAll('CREATE')}
                    className="rounded-md border border-[var(--bg-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  >
                    Tất cả Thêm mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll('UPDATE')}
                    className="rounded-md border border-[var(--bg-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  >
                    Tất cả Cập nhật
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--bg-border)]">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[var(--bg-elevated)]/95 text-xs text-[var(--text-muted)] backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-medium">Dòng</th>
                        <th className="px-3 py-2 font-medium">SKU / Thuộc tính</th>
                        <th className="px-3 py-2 font-medium">Trạng thái</th>
                        <th className="px-3 py-2 font-medium">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewRows.map((r, i) => (
                        <tr key={r.key ?? i} className="border-t border-[var(--bg-border)]/60">
                          <td className="px-3 py-2 text-[var(--text-muted)]">{r.rowNumber ?? '—'}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-[var(--text-primary)]">{r.skuCode ?? '—'}</div>
                            {r.optionsLabel ? (
                              <div className="text-xs text-[var(--text-muted)]">{r.optionsLabel}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                r.exists
                                  ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                  : 'bg-[var(--accent)]/10 text-[var(--accent)]'
                              )}
                            >
                              {r.exists ? 'Đã có' : 'Mới'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <ActionToggle
                              value={r.key ? actions[r.key] ?? 'CREATE' : 'CREATE'}
                              onChange={(a) => r.key && setAction(r.key, a)}
                            />
                          </td>
                        </tr>
                      ))}
                      {reviewFails.map((r, i) => (
                        <tr key={`f-${i}`} className="border-t border-[var(--bg-border)]/60 bg-[var(--danger)]/5">
                          <td className="px-3 py-2 text-[var(--text-muted)]">{r.rowNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text-primary)]">{r.skuCode ?? r.optionsLabel ?? '—'}</td>
                          <td className="px-3 py-2" colSpan={2}>
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--danger)]">
                              <AlertCircle className="size-3.5" /> {r.message ?? 'Lỗi'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={<Layers className="size-4" />} label="Tổng" value={result.totalVariants} tone="muted" />
                <StatCard icon={<Plus className="size-4" />} label="Thêm mới" value={result.createdCount ?? 0} tone="accent" />
                <StatCard icon={<RefreshCw className="size-4" />} label="Cập nhật" value={result.updatedCount ?? 0} tone="success" />
                <StatCard icon={<AlertTriangle className="size-4" />} label="Lỗi" value={result.failureCount} tone="danger" />
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--bg-border)]">
                <div className="bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Chi tiết {result.results.length} dòng
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[var(--bg-elevated)]/95 text-xs text-[var(--text-muted)] backdrop-blur">
                      <tr>
                        <th className="px-4 py-2 font-medium">Dòng</th>
                        <th className="px-4 py-2 font-medium">SKU / Thuộc tính</th>
                        <th className="px-4 py-2 font-medium">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={i} className="border-t border-[var(--bg-border)]/60">
                          <td className="px-4 py-2 text-[var(--text-muted)]">{r.rowNumber ?? '—'}</td>
                          <td className="px-4 py-2">
                            <div className="font-medium text-[var(--text-primary)]">{r.skuCode ?? '—'}</div>
                            {r.optionsLabel ? (
                              <div className="text-xs text-[var(--text-muted)]">{r.optionsLabel}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={clsx(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                  r.success
                                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                    : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                )}
                              >
                                {r.success ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                                {r.success ? (r.action === 'UPDATE' ? 'Đã cập nhật' : 'Đã thêm') : 'Lỗi'}
                              </span>
                              {r.message && <span className="text-xs text-[var(--text-muted)]">{r.message}</span>}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 px-6 py-4">
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={!file || busy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                {previewing ? 'Đang phân tích…' : 'Xem trước'}
              </button>
            </>
          )}
          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setPreview(null);
                }}
                disabled={busy}
                className="rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={busy || reviewRows.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {uploading ? 'Đang import…' : `Xác nhận import (${reviewRows.length})`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}

function ActionToggle({ value, onChange }: { value: ProductImportAction; onChange: (a: ProductImportAction) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--bg-border)]">
      {(['CREATE', 'UPDATE'] as ProductImportAction[]).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={clsx(
            'px-3 py-1 text-xs font-semibold transition-colors',
            value === a
              ? a === 'CREATE'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--success)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
          )}
        >
          {a === 'CREATE' ? 'Thêm mới' : 'Cập nhật'}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'accent' | 'danger' | 'muted';
}) {
  const toneCls =
    tone === 'success'
      ? 'text-[var(--success)] bg-[var(--success)]/10'
      : tone === 'accent'
        ? 'text-[var(--accent)] bg-[var(--accent)]/10'
        : tone === 'danger'
          ? 'text-[var(--danger)] bg-[var(--danger)]/10'
          : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)]';
  return (
    <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-3">
      <div className={clsx('mb-2 flex size-8 items-center justify-center rounded-lg', toneCls)}>{icon}</div>
      <div className="text-2xl font-bold leading-none text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

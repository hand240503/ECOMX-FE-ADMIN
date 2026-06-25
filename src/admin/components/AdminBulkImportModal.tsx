import { useCallback, useEffect, useRef, useState } from 'react';
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
  ListChecks,
  Trash2,
} from 'lucide-react';
import type { CatalogImportResponse } from '../../api/types/catalogImport.types';
import { ImportRowSelector } from './ImportRowSelector';
import { useImportRowSelection } from './useImportRowSelection';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Tiêu đề modal, ví dụ "Nhập tồn kho từ Excel". */
  title: string;
  /** Mô tả ngắn dưới tiêu đề. */
  subtitle?: string;
  /** Hàm gọi API import (multipart file). */
  importFn: (file: File) => Promise<CatalogImportResponse>;
  /** Hàm tải file mẫu (blob). */
  templateFn: () => Promise<Blob>;
  /** Tên file mẫu khi tải về. */
  templateFileName: string;
  /** Nhãn cho cột "tạo mới" (mặc định "Thành công"). */
  createdLabel?: string;
  /** Nhãn cho cột "cập nhật" (ẩn nếu không truyền). */
  updatedLabel?: string;
  /** Ẩn ô thống kê "tạo mới" (dùng cho luồng chỉ cập nhật, ví dụ gán danh mục/thương hiệu). */
  hideCreated?: boolean;
  /** Gọi lại sau khi import có ít nhất 1 dòng thành công. */
  onImported?: () => void;
};

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

/** Modal import dùng chung: tồn kho, PC, PWP, Mix & Match (trả về CatalogImportResponse). */
/* Hỗ trợ chọn dòng cần nhập bằng ô tích (mặc định chọn tất cả). */
export function AdminBulkImportModal({
  open,
  onClose,
  title,
  subtitle,
  importFn,
  templateFn,
  templateFileName,
  createdLabel = 'Thành công',
  updatedLabel,
  hideCreated = false,
  onImported,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<CatalogImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useImportRowSelection();

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setUploading(false);
    setParsing(false);
    setDragOver(false);
    selection.reset();
  }, [selection]);

  const handleClose = useCallback(() => {
    if (uploading) return;
    reset();
    onClose();
  }, [uploading, reset, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const pickFile = useCallback(
    async (f: File | null) => {
      setResult(null);
      setError(null);
      if (!f) return;
      if (!isValidFile(f.name)) {
        setError('Chỉ chấp nhận file .xlsx, .xls, .csv hoặc .txt');
        return;
      }
      setFile(f);
      setParsing(true);
      try {
        const grid = await selection.parse(f);
        if (grid.rows.length === 0) {
          setError('File không có dòng dữ liệu nào để nhập.');
        }
      } catch {
        setError('Không đọc được file. Kiểm tra lại định dạng .xlsx, .xls, .csv hoặc .txt');
        setFile(null);
        selection.reset();
      } finally {
        setParsing(false);
      }
    },
    [selection]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
    selection.reset();
  }, [selection]);

  const handleDownloadTemplate = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await templateFn();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Không tải được file mẫu');
    } finally {
      setDownloading(false);
    }
  }, [templateFn, templateFileName]);

  const handleUpload = useCallback(async () => {
    if (!file || selection.selectedCount === 0) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const filtered = selection.buildFile(file.name);
      const res = await importFn(filtered);
      setResult(res);
      const okCount = res.createdCount + res.updatedCount;
      if (okCount > 0) {
        toast.success(`Đã xử lý ${okCount} dòng thành công`);
        onImported?.();
      }
      if (res.failureCount > 0) {
        toast.error(`${res.failureCount} dòng lỗi — xem chi tiết bên dưới`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import thất bại';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [file, selection, importFn, onImported]);

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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bg-border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <UploadCloud className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-admin-heading)] text-lg font-semibold leading-tight text-[var(--text-primary)]">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Mỗi dòng xử lý độc lập; dòng lỗi được báo cáo, không chặn cả file. Chưa rõ định dạng? Tải file mẫu để bắt đầu.
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
              {!uploading && !parsing && (
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
                void pickFile(e.dataTransfer.files?.[0] ?? null);
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
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
          />

          {parsing && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-4 py-3 text-sm text-[var(--text-secondary)]">
              <Loader2 className="size-4 animate-spin" /> Đang đọc file…
            </div>
          )}

          {file && !parsing && !result && selection.grid.rows.length > 0 && (
            <ImportRowSelector
              grid={selection.grid}
              selected={selection.selected}
              onToggle={selection.toggle}
              onSelectAll={selection.selectAll}
              onClearAll={selection.clearAll}
              note="Bỏ tích những dòng bạn KHÔNG muốn nhập / cập nhật. Mặc định chọn tất cả."
            />
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard icon={<ListChecks className="size-4" />} label="Tổng dòng" value={result.totalRows} tone="muted" />
                {!hideCreated && (
                  <StatCard icon={<CheckCircle2 className="size-4" />} label={createdLabel} value={result.createdCount} tone="success" />
                )}
                {updatedLabel && (
                  <StatCard icon={<CheckCircle2 className="size-4" />} label={updatedLabel} value={result.updatedCount} tone="accent" />
                )}
                {(result.skippedCount ?? 0) > 0 && (
                  <StatCard icon={<Info className="size-4" />} label="Bỏ qua" value={result.skippedCount ?? 0} tone="muted" />
                )}
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
                        <th className="px-4 py-2 font-medium">Đối tượng</th>
                        <th className="px-4 py-2 font-medium">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={i} className="border-t border-[var(--bg-border)]/60">
                          <td className="px-4 py-2 text-[var(--text-muted)]">{r.rowNumber ?? '—'}</td>
                          <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{r.key ?? '—'}</td>
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
                                {r.success ? 'OK' : 'Lỗi'}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--bg-border)] px-6 py-4">
          <span className="text-xs text-[var(--text-muted)]">
            {file && selection.grid.rows.length > 0
              ? `Đã chọn ${selection.selectedCount}/${selection.grid.rows.length} dòng`
              : 'Chưa có dữ liệu'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              {result ? 'Đóng' : 'Hủy'}
            </button>
            {!result && (
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={!file || parsing || uploading || selection.selectedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {uploading
                  ? 'Đang nhập…'
                  : selection.selectedCount > 0
                    ? `Nhập ${selection.selectedCount} dòng`
                    : 'Nhập'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

type StatTone = 'muted' | 'success' | 'accent' | 'danger';

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: StatTone;
}) {
  const toneClass: Record<StatTone, string> = {
    muted: 'text-[var(--text-secondary)]',
    success: 'text-[var(--success)]',
    accent: 'text-[var(--accent)]',
    danger: 'text-[var(--danger)]',
  };
  return (
    <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-3 py-2.5">
      <div className={clsx('flex items-center gap-1.5 text-xs font-medium', toneClass[tone])}>
        {icon}
        {label}
      </div>
      <div className={clsx('mt-1 text-xl font-bold', toneClass[tone])}>{value}</div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { UploadCloud, X, FileSpreadsheet, AlertCircle, Loader2, Info, Trash2, ArrowRight } from 'lucide-react';
import { notify } from '../../utils/notify';
import { adminBrandService } from '../../api/services/adminBrandService';
import { adminCategoryService } from '../../api/services/adminCategoryService';
import { ImportRowSelector } from './ImportRowSelector';
import { useImportRowSelection } from './useImportRowSelection';

type Kind = 'brand' | 'category';

type Props = {
  open: boolean;
  onClose: () => void;
  kind: Kind;
};

/** Render trong .admin-portal để kế thừa biến theme (--bg-surface…); fallback body. */
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

/**
 * Popup chọn file để nhập thương hiệu / danh mục.
 * Sau khi chọn + phân tích (xem trước), điều hướng sang TRANG review riêng để xác nhận.
 */
export function AdminCatalogImportModal({ open, onClose, kind }: Props) {
  const navigate = useNavigate();
  const cfg =
    kind === 'brand'
      ? { title: 'Nhập / cập nhật thương hiệu', reviewPath: '/admin/brands/import', previewFn: adminBrandService.previewXlsx }
      : { title: 'Nhập / cập nhật danh mục', reviewPath: '/admin/categories/import', previewFn: adminCategoryService.previewXlsx };

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useImportRowSelection();

  const reset = useCallback(() => {
    setFile(null);
    setError(null);
    setDragOver(false);
    setLoading(false);
    setParsing(false);
    selection.reset();
  }, [selection]);

  const handleClose = useCallback(() => {
    if (loading) return;
    reset();
    onClose();
  }, [loading, reset, onClose]);

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
        if (grid.rows.length === 0) setError('File không có dòng dữ liệu nào để nhập.');
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

  const handleContinue = useCallback(async () => {
    if (!file || selection.selectedCount === 0) return;
    setLoading(true);
    setError(null);
    try {
      const filtered = selection.buildFile(file.name);
      const preview = await cfg.previewFn(filtered);
      // Chuyển sang trang review, mang theo file đã LỌC (chỉ dòng được chọn) + dữ liệu xem trước.
      navigate(cfg.reviewPath, {
        state: { file: filtered, fileName: file.name, fileSize: filtered.size, preview },
      });
      reset();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Phân tích file thất bại';
      setError(msg);
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, [file, selection, cfg, navigate, reset, onClose]);

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
              <UploadCloud className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-admin-heading)] text-lg font-semibold leading-tight text-[var(--text-primary)]">
                {cfg.title}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Chọn file Excel / CSV / TXT để xem trước</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex gap-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Chọn đúng file đã xuất. Sau khi bấm <b className="text-[var(--text-primary)]">Tiếp tục</b>, hệ thống phân
              tích và mở trang xem trước thay đổi — chưa ghi gì cho tới khi bạn xác nhận.
            </p>
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
              {!loading && !parsing && (
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

          {file && !parsing && selection.grid.rows.length > 0 && (
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!file || loading || parsing || selection.selectedCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {loading
              ? 'Đang phân tích…'
              : selection.selectedCount > 0
                ? `Tiếp tục (${selection.selectedCount})`
                : 'Tiếp tục'}
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

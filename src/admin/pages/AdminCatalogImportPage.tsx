import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FilePlus2,
  RefreshCw,
  Info,
  ListChecks,
  UploadCloud,
} from 'lucide-react';
import { notify } from '../../utils/notify';
import { adminBrandService } from '../../api/services/adminBrandService';
import { adminCategoryService } from '../../api/services/adminCategoryService';
import type { CatalogImportResponse } from '../../api/types/catalogImport.types';

type Kind = 'brand' | 'category';

type ImportState = {
  file?: File;
  fileName?: string;
  fileSize?: number;
  preview?: CatalogImportResponse;
};

function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminCatalogImportPage({ kind }: { kind: Kind }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const state = (location.state ?? {}) as ImportState;

  const cfg =
    kind === 'brand'
      ? {
          title: 'Xem trước nhập thương hiệu',
          listPath: '/admin/brands',
          queryKey: ['admin-brands'] as const,
          importFn: adminBrandService.importXlsx,
        }
      : {
          title: 'Xem trước nhập danh mục',
          listPath: '/admin/categories',
          queryKey: ['admin-categories'] as const,
          importFn: adminCategoryService.importXlsx,
        };

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<CatalogImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goList = useCallback(() => navigate(cfg.listPath), [navigate, cfg.listPath]);

  const handleConfirm = useCallback(async () => {
    if (!state.file) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await cfg.importFn(state.file);
      setResult(res);
      if (res.createdCount > 0 || res.updatedCount > 0) {
        notify.success(`Đã thêm mới ${res.createdCount}, cập nhật ${res.updatedCount}`);
        void queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      }
      if (res.failureCount > 0) notify.error(`${res.failureCount} dòng lỗi`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nhập thất bại';
      setError(msg);
      notify.error(msg);
    } finally {
      setConfirming(false);
    }
  }, [state.file, cfg, queryClient]);

  const preview = state.preview ?? null;
  const data = result ?? preview;
  const isConfirmed = result != null;

  // Không có dữ liệu xem trước (vd mở trực tiếp / refresh) → quay lại để chọn file.
  if (!preview) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center shadow-[var(--card-shadow)]">
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <UploadCloud className="size-7" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Chưa có dữ liệu xem trước</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Hãy quay lại danh sách và bấm “Nhập Excel” để chọn file.
            </p>
          </div>
          <button
            type="button"
            onClick={goList}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <ArrowLeft className="size-4" /> Về danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goList}
          className="flex size-9 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Quay lại"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
            {isConfirmed ? cfg.title.replace('Xem trước', 'Kết quả') : cfg.title}
          </h1>
          {(state.fileName || state.fileSize != null) && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <FileSpreadsheet className="size-3.5" /> {state.fileName}
              {state.fileSize != null && <span className="text-[var(--text-muted)]">· {formatSize(state.fileSize)}</span>}
            </p>
          )}
        </div>
      </div>

      {isConfirmed && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-4 py-3 text-sm font-medium text-[var(--success)]">
          <CheckCircle2 className="size-5" /> Đã ghi vào hệ thống thành công.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5 shadow-[var(--card-shadow)]">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<FilePlus2 className="size-4" />}
            label={isConfirmed ? 'Đã thêm mới' : 'Sẽ thêm mới'}
            value={data!.createdCount}
            tone="success"
          />
          <StatCard
            icon={<RefreshCw className="size-4" />}
            label={isConfirmed ? 'Đã cập nhật' : 'Sẽ cập nhật'}
            value={data!.updatedCount}
            tone="accent"
          />
          <StatCard icon={<AlertTriangle className="size-4" />} label="Lỗi" value={data!.failureCount} tone="danger" />
        </div>

        {!isConfirmed && (
          <div className="mt-4 flex gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Đây là xem trước — chưa có gì được ghi. Bấm <b>Xác nhận nhập</b> để áp dụng.
            </p>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--bg-border)]">
          <div className="flex items-center gap-2 bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <ListChecks className="size-4" /> Chi tiết {data!.results.length} dòng
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--bg-elevated)]/95 text-xs text-[var(--text-muted)] backdrop-blur">
                <tr>
                  <th className="px-4 py-2 font-medium">Dòng</th>
                  <th className="px-4 py-2 font-medium">Khóa</th>
                  <th className="px-4 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data!.results.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--bg-border)]/60">
                    <td className="px-4 py-2 text-[var(--text-muted)]">{r.rowNumber ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{r.key ?? '—'}</td>
                    <td className="px-4 py-2">
                      <ActionPill action={r.action} success={r.success} message={r.message} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3">
        {isConfirmed ? (
          <button
            type="button"
            onClick={goList}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
          >
            Về danh sách
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={goList}
              disabled={confirming}
              className="rounded-lg border border-[var(--bg-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={confirming || data!.createdCount + data!.updatedCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {confirming ? 'Đang ghi…' : 'Xác nhận nhập'}
            </button>
          </>
        )}
      </div>
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
  tone: 'success' | 'accent' | 'danger';
}) {
  const toneCls =
    tone === 'success'
      ? 'text-[var(--success)] bg-[var(--success)]/10'
      : tone === 'accent'
        ? 'text-[var(--accent)] bg-[var(--accent)]/10'
        : 'text-[var(--danger)] bg-[var(--danger)]/10';
  return (
    <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-3">
      <div className={clsx('mb-2 flex size-8 items-center justify-center rounded-lg', toneCls)}>{icon}</div>
      <div className="text-2xl font-bold leading-none text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function ActionPill({
  action,
  success,
  message,
}: {
  action: string | null;
  success: boolean;
  message: string | null;
}) {
  const cfg = !success
    ? { cls: 'bg-[var(--danger)]/10 text-[var(--danger)]', icon: <AlertCircle className="size-3.5" />, label: 'Lỗi' }
    : action === 'CREATED'
      ? { cls: 'bg-[var(--success)]/10 text-[var(--success)]', icon: <FilePlus2 className="size-3.5" />, label: 'Thêm mới' }
      : { cls: 'bg-[var(--accent)]/10 text-[var(--accent)]', icon: <RefreshCw className="size-3.5" />, label: 'Cập nhật' };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.cls)}>
        {cfg.icon}
        {cfg.label}
      </span>
      {message && <span className="text-xs text-[var(--text-muted)]">{message}</span>}
    </span>
  );
}

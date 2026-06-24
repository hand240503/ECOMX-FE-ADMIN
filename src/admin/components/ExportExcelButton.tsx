import { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { Download, Loader2 } from 'lucide-react';
import { notify } from '../../utils/notify';

type Props = {
  /** Hàm gọi API trả về Blob (file Excel). */
  fetcher: (signal?: AbortSignal) => Promise<Blob>;
  /** Tiền tố tên file tải về, sẽ kèm timestamp. VD: 'thuong_hieu_export'. */
  filePrefix: string;
  label?: string;
  className?: string;
};

/** Nút tải file Excel dùng chung — xử lý tải blob, đặt tên file, toast lỗi. */
export function ExportExcelButton({ fetcher, filePrefix, label = 'Xuất Excel', className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const blob = await fetcher();
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filePrefix}_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify.error('Xuất Excel thất bại');
    } finally {
      setLoading(false);
    }
  }, [fetcher, filePrefix]);

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold',
        'text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden />}
      {loading ? 'Đang xuất…' : label}
    </button>
  );
}

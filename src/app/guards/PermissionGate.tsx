/**
 * PermissionGate.tsx
 *
 * Bao bọc một route/trang để chặn user không có quyền xem.
 * Nếu `canView()` trả về false → hiển thị trang "Không có quyền truy cập"
 * thay vì redirect (để tránh loop và giữ URL rõ ràng).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

interface Props {
  /** Hàm kiểm tra quyền xem — thường là adminAccessControlUi.canView*() */
  canView: () => boolean;
  children: ReactNode;
}

export function PermissionGate({ canView, children }: Props) {
  if (canView()) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--danger)]/10">
        <ShieldOff className="size-9 text-[var(--danger)]" />
      </div>

      {/* Message */}
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Không có quyền truy cập
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Tài khoản của bạn chưa được cấp quyền <strong>Xem</strong> cho mục này.
          Liên hệ quản trị viên để được cấp quyền phù hợp.
        </p>
      </div>

      {/* Back link */}
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all"
      >
        Về Dashboard
      </Link>
    </div>
  );
}

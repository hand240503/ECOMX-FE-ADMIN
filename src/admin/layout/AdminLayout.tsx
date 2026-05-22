import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { useAdminThemeStore } from '../theme/adminThemeStore';

export function AdminLayout() {
  const mode = useAdminThemeStore((s) => s.mode);

  return (
    <div
      className="admin-portal flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
      data-admin-theme={mode}
    >
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-auto bg-[var(--bg-base)] p-6">
          {/* Căn trái (không mx-auto) để không tạo lề trống lớn giữa sidebar app và nội dung */}
          <div className="w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

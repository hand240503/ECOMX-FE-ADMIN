import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { AdminThemeToggle } from '../components/AdminThemeToggle';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../../api/services';
import { useAuth } from '../../app/auth/AuthProvider';
import { clsx } from 'clsx';

const pathTitleMap: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/products': 'Sản phẩm',
  '/admin/products/featured': 'Nổi bật',
  '/admin/products/hot-sale': 'Hot-sale',
  '/admin/products/mix-and-match': 'Mix-and-match',
  '/admin/products/purchase-with-purchase': 'Mua kèm (PwP)',
  '/admin/pricing': 'Giá & khuyến mãi',
  '/admin/pricing/catalog': 'Giá niêm yết',
  '/admin/pricing/time-change': 'Giá theo khung thời gian',
  '/admin/pricing/volume': 'Giá theo bậc số lượng',
  '/admin/pricing/pwp': 'Chương trình mua kèm',
  '/admin/pricing/units': 'Đơn vị tính',
  // Legacy paths giữ map để breadcrumb hiển thị đúng khi redirect
  '/admin/price': 'Giá & khuyến mãi',
  '/admin/price/catalog': 'Giá niêm yết',
  '/admin/price/price-changes': 'Giá theo khung thời gian',
  '/admin/price/mix-and-match': 'Giá theo bậc số lượng',
  '/admin/price/purchase-with-purchase': 'Chương trình mua kèm',
  '/admin/products/create': 'Tạo sản phẩm',
  '/admin/categories': 'Danh mục',
  '/admin/orders': 'Đơn hàng',
  '/admin/warehouse': 'Kho',
  '/admin/staff': 'Nhân viên nội bộ',
  '/admin/staff/create': 'Tạo nhân viên nội bộ',
  '/admin/employees': 'Nhân viên EMPLOYEE',
  '/admin/employees/create': 'Tạo nhân viên EMPLOYEE',
  '/admin/customers': 'Khách hàng',
  '/admin/customers/create': 'Khách hàng',
  '/admin/roles': 'Chức vụ',
  '/admin/documents': 'Tài liệu',
  '/admin/reports': 'Báo cáo',
  '/admin/settings': 'Cấu hình hệ thống',
  '/login': 'Đăng nhập',
};

function breadcrumbForPath(pathname: string): { label: string; to?: string }[] {
  if (pathname === '/admin') return [{ label: 'Dashboard' }];
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Admin', to: '/admin' }];
  let acc = '';
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const label = /^\/admin\/products\/\d+\/edit$/.test(acc)
      ? 'Sửa sản phẩm'
      : /^\/admin\/orders\/\d+$/.test(acc)
        ? 'Chi tiết đơn hàng'
        : /^\/admin\/staff\/\d+\/edit$/.test(acc)
        ? 'Sửa nhân viên nội bộ'
        : /^\/admin\/employees\/\d+\/edit$/.test(acc)
          ? 'Sửa nhân viên EMPLOYEE'
          : /^\/admin\/customers\/\d+\/edit$/.test(acc)
            ? 'Chi tiết khách hàng'
            : pathTitleMap[acc] ?? segments[i];
    const isLast = i === segments.length - 1;
    crumbs.push({ label, to: isLast ? undefined : acc });
  }
  return crumbs;
}

export function AdminTopbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const crumbs = breadcrumbForPath(location.pathname);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    window.location.assign('/login');
  }, []);

  const displayName = user?.userInfo?.fullName?.trim() || user?.email || 'Admin';

  return (
    <header
      className={clsx(
        'admin-portal sticky top-0 z-[100] flex h-16 shrink-0 items-center gap-4 border-b px-6',
        'border-[var(--bg-border)] bg-[var(--bg-surface)]'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {crumbs.map((c, idx) => (
          <span key={`${c.label}-${idx}`} className="flex items-center gap-2 text-[var(--text-secondary)]">
            {idx > 0 ? <ChevronRight className="size-4 opacity-60" aria-hidden /> : null}
            {c.to ? (
              <Link to={c.to} className="truncate hover:text-[var(--accent)]">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold text-[var(--text-primary)]">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <AdminThemeToggle />
        <button
          type="button"
          aria-label="Thông báo"
          className={clsx(
            'relative rounded-lg p-2 text-[var(--text-secondary)]',
            'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
          )}
        >
          <Bell className="size-5" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-[var(--danger)]" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-2 rounded-lg py-1.5 ps-1 pe-2',
              'hover:bg-[var(--bg-elevated)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate text-left text-sm font-medium text-[var(--text-primary)] lg:block">
              {displayName}
            </span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className={clsx(
                'absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border shadow-[var(--dropdown-shadow)]',
                'border-[var(--bg-border)] bg-[var(--bg-surface)]'
              )}
            >
              <div className="border-b border-[var(--bg-border)] px-3 py-2">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{displayName}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                onClick={() => setMenuOpen(false)}
              >
                Hồ sơ
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                onClick={() => setMenuOpen(false)}
              >
                Đổi mật khẩu
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                onClick={() => void logout()}
              >
                Đăng xuất
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

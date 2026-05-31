import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, CheckCheck, Package, RefreshCw, MessageSquare, AtSign, Clock, Trash2, Paperclip } from 'lucide-react';
import { AdminThemeToggle } from '../components/AdminThemeToggle';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../api/services';
import { useAuth } from '../../app/auth/AuthProvider';
import { clsx } from 'clsx';
import { adminTaskService } from '../../api/services/adminTaskService';
import type { TaskNotificationResponse } from '../../api/types/task.types';
import { notify } from '../../utils/notify';

const pathTitleMap: Record<string, string> = {
  '/admin': 'Tổng quan',
  '/admin/products': 'Sản phẩm',
  '/admin/products/featured': 'Nổi bật',
  '/admin/products/hot-sale': 'Bán chạy',
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
  '/admin/tasks': 'Quản lý công việc',
  '/admin/orders': 'Đơn hàng',
  '/admin/warehouse': 'Kho',
  '/admin/staff': 'Nhân viên nội bộ',
  '/admin/staff/create': 'Tạo nhân viên nội bộ',
  '/admin/customers': 'Khách hàng',
  '/admin/customers/create': 'Khách hàng',
  '/admin/roles': 'Chức vụ',
  '/admin/documents': 'Tài liệu',
  '/admin/reports': 'Báo cáo',
  '/admin/settings': 'Cấu hình hệ thống',
  '/login': 'Đăng nhập',
};

function breadcrumbForPath(pathname: string): { label: string; to?: string }[] {
  if (pathname === '/admin') return [{ label: 'Tổng quan' }];
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Tổng quan', to: '/admin' }];
  let acc = '';
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const label = /^\/admin\/products\/\d+\/edit$/.test(acc)
      ? 'Sửa sản phẩm'
      : /^\/admin\/orders\/\d+$/.test(acc)
        ? 'Chi tiết đơn hàng'
        : /^\/admin\/staff\/\d+\/edit$/.test(acc)
        ? 'Sửa nhân viên nội bộ'
        : /^\/admin\/customers\/\d+\/edit$/.test(acc)
            ? 'Chi tiết khách hàng'
            : pathTitleMap[acc] ?? segments[i];
    const isLast = i === segments.length - 1;
    crumbs.push({ label, to: isLast ? undefined : acc });
  }
  return crumbs;
}

const NOTIF_ICON: Record<string, React.ReactNode> = {
  ASSIGNED:         <Package size={13} />,
  STATUS_CHANGED:   <RefreshCw size={13} />,
  COMMENT_ADDED:    <MessageSquare size={13} />,
  MENTIONED:        <AtSign size={13} />,
  DUE_DATE_APPROACHING: <Clock size={13} />,
  ATTACHMENT_ADDED: <Paperclip size={13} />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export function AdminTopbar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();
  const qc = useQueryClient();
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [bellOpen,  setBellOpen]  = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['task-notif-count'],
    queryFn: ({ signal }) => adminTaskService.getUnreadCount(signal),
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['task-notif-list'],
    queryFn: ({ signal }) => adminTaskService.getAllNotifications(0, 10, signal),
    enabled: bellOpen,
  });

  const markRead = async (n: TaskNotificationResponse) => {
    if (!n.isRead) {
      await adminTaskService.markNotificationRead(n.id);
      void qc.invalidateQueries({ queryKey: ['task-notif-count'] });
      void qc.invalidateQueries({ queryKey: ['task-notif-list'] });
    }
    if (n.taskId) navigate(`/admin/tasks`);
    setBellOpen(false);
  };

  const markAll = async () => {
    await adminTaskService.markAllNotificationsRead();
    void qc.invalidateQueries({ queryKey: ['task-notif-count'] });
    void qc.invalidateQueries({ queryKey: ['task-notif-list'] });
  };

  const deleteNotif = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await adminTaskService.deleteNotification(id);
      void qc.invalidateQueries({ queryKey: ['task-notif-count'] });
      void qc.invalidateQueries({ queryKey: ['task-notif-list'] });
    } catch {
      notify.error('Xóa thông báo thất bại');
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo?')) return;
    try {
      await adminTaskService.deleteAllNotifications();
      void qc.invalidateQueries({ queryKey: ['task-notif-count'] });
      void qc.invalidateQueries({ queryKey: ['task-notif-list'] });
    } catch {
      notify.error('Xóa thông báo thất bại');
    }
  };


  const crumbs = breadcrumbForPath(location.pathname);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
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

        {/* ── Notification bell ── */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            aria-label="Thông báo"
            onClick={() => setBellOpen(v => !v)}
            className={clsx(
              'relative rounded-lg p-2 text-[var(--text-secondary)]',
              'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              bellOpen && 'bg-[var(--bg-elevated)] text-[var(--text-primary)]',
            )}
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--danger)] px-[3px] text-[9px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className={clsx(
              'absolute right-0 mt-2 w-[340px] overflow-hidden rounded-xl border shadow-[var(--dropdown-shadow)]',
              'border-[var(--bg-border)] bg-[var(--bg-surface)]',
            )}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--bg-border)] px-4 py-3">
                <span className="text-[13px] font-bold text-[var(--text-primary)]">
                  Thông báo {unreadCount > 0 && <span className="ml-1 rounded-full bg-[var(--danger)] px-[6px] py-[1px] text-[10px] text-white">{unreadCount}</span>}
                </span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => void markAll()}
                      className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                    >
                      <CheckCheck size={12} /> Đọc tất cả
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={deleteAll}
                      className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:underline"
                    >
                      <Trash2 size={12} /> Xóa tất cả
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-[var(--text-muted)]">
                    <Bell size={24} className="mx-auto mb-2 opacity-30" />
                    Không có thông báo mới
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => void markRead(n)}
                      className={clsx(
                        'group flex w-full items-start gap-3 border-b border-[var(--bg-border)] px-4 py-3 text-left transition-colors last:border-0',
                        'hover:bg-[var(--bg-elevated)] relative',
                        !n.isRead && 'bg-[var(--accent-soft)]',
                      )}
                    >
                      <div className={clsx(
                        'mt-[2px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                        !n.isRead ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-border)] text-[var(--text-muted)]',
                      )}>
                        {NOTIF_ICON[n.notificationType] ?? <Bell size={13} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[12px] font-semibold text-[var(--text-primary)]">{n.title}</p>
                        {n.body && <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">{n.body}</p>}
                        <p className="mt-[2px] text-[10px] text-[var(--text-muted)]">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)] group-hover:hidden" />}
                      <div className="hidden mt-[2px] group-hover:block" onClick={e => deleteNotif(e, n.id)}>
                        <Trash2 size={14} className="text-[var(--text-muted)] hover:text-[var(--danger)]" title="Xóa" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-[var(--bg-border)] px-4 py-2 text-center">
                <Link
                  to="/admin/tasks"
                  onClick={() => setBellOpen(false)}
                  className="text-[11.5px] font-medium text-[var(--accent)] hover:underline"
                >
                  Xem tất cả trong Task Management
                </Link>
              </div>
            </div>
          )}
        </div>

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
                className="block w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/admin/profile');
                }}
              >
                Hồ sơ
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

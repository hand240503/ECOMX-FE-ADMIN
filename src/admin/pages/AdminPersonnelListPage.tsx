import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Pencil, Search } from 'lucide-react';
import {
  adminCustomerService,
  adminStaffService,
} from '../../api/services/adminStaffEmployeeService';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { getApiErrorMessage } from '../../utils/apiError';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';
import type { AdminPersonnelSegment } from '../../api/types/adminAccessControl.types';

const PAGE_SIZE = 10;

const copy: Record<
  AdminPersonnelSegment,
  {
    title: string;
    headerTitle: string;
    createLabel: string;
    empty: string;
    apiHint: string;
    basePath: string;
    allowCreate: boolean;
  }
> = {
  staff: {
    title: 'Nhân viên nội bộ',
    headerTitle: 'Nhân viên nội bộ',
    createLabel: 'Tạo nhân viên nội bộ',
    empty: 'Không có bản ghi trên trang này hoặc sau khi lọc.',
    apiHint: 'Danh sách tài khoản nhân viên nội bộ (không bao gồm khách hàng).',
    basePath: '/admin/staff',
    allowCreate: true,
  },
  customer: {
    title: 'Khách hàng',
    headerTitle: 'Khách hàng',
    createLabel: '',
    empty: 'Không có khách hàng trên trang này hoặc sau khi lọc.',
    apiHint: 'Danh sách khách hàng đã đăng ký. Chỉ xem, không chỉnh sửa.',
    basePath: '/admin/customers',
    allowCreate: false,
  },
};

type Props = { variant: AdminPersonnelSegment };

export default function AdminPersonnelListPage({ variant }: Props) {
  const canList = adminAccessControlUi.listUsers();
  const canCreate = adminAccessControlUi.createUser();
  const canUpdate = adminAccessControlUi.updateUser();
  const c = copy[variant];

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin-personnel-list', variant, page, PAGE_SIZE],
    queryFn: ({ signal }) => {
      if (variant === 'staff') return adminStaffService.listPaged(page, PAGE_SIZE, signal);
      return adminCustomerService.listPaged(page, PAGE_SIZE, signal);
    },
    staleTime: 30_000,
    enabled: canList,
  });

  const showRolesColumn = variant !== 'customer';

  const HIDDEN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN']);

  const tableRows = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    // Ẩn tài khoản ADMIN và SUPER_ADMIN khỏi danh sách nhân sự
    const visible = variant === 'staff'
      ? items.filter((u) => !(u.roles ?? []).some((r) => HIDDEN_ROLES.has(r.toUpperCase())))
      : items;
    const q = filter.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((u) => {
      if (String(u.id).includes(q)) return true;
      if ((u.username ?? '').toLowerCase().includes(q)) return true;
      if ((u.email ?? '').toLowerCase().includes(q)) return true;
      if ((u.phoneNumber ?? '').toLowerCase().includes(q)) return true;
      if (variant !== 'customer' && (u.roles ?? []).some((r) => r.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [listQuery.data, filter, variant]);

  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);
  const totalElements = listQuery.data?.totalElements ?? 0;

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  if (!canList) {
    return (
      <div className="space-y-4">
        <PricingPageHeader title={c.title} />
        <p className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm text-[var(--text-secondary)]">
          Bạn không có quyền xem danh sách này.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PricingPageHeader title={c.headerTitle} />
        {c.allowCreate && canCreate ? (
          <Link
            to={`${c.basePath}/create`}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            {c.createLabel}
          </Link>
        ) : null}
      </div>

      <p className="text-sm text-[var(--text-secondary)]">{c.title}</p>
      <p className="text-[11px] leading-snug text-[var(--text-muted)]">{c.apiHint}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={
              variant === 'customer'
                ? 'Lọc theo id, username, email, SĐT… (trang hiện tại)'
                : 'Lọc theo id, username, email, SĐT, role… (trang hiện tại)'
            }
            className={clsx(inputCls, 'w-full pl-9')}
          />
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">
          Tổng ~{totalElements} · Trang API {page + 1}/{totalPages}
        </p>
      </div>

      {listQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được danh sách')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table
              className={clsx(
                'w-full border-collapse text-left text-sm',
                showRolesColumn ? 'min-w-[920px]' : 'min-w-[760px]'
              )}
            >
              <thead>
                <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">SĐT</th>
                  {showRolesColumn ? <th className="px-4 py-3 font-semibold">Roles</th> : null}
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="w-28 px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={showRolesColumn ? 7 : 6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      {c.empty}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--bg-border)]/80 hover:bg-[var(--bg-elevated)]/40">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{u.id}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{u.username ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{u.phoneNumber ?? '—'}</td>
                      {showRolesColumn ? (
                        <td className="max-w-[200px] px-4 py-3 text-xs text-[var(--text-secondary)]">
                          <span className="line-clamp-2" title={(u.roles ?? []).join(', ')}>
                            {(u.roles ?? []).join(', ') || '—'}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        {(u.status ?? 1) === 1 ? (
                          <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
                        ) : (
                          <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`${c.basePath}/${u.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          {variant === 'customer' ? 'Chi tiết' : canUpdate ? 'Sửa' : 'Xem'}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 0 || listQuery.isLoading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          Trang trước
        </button>
        <button
          type="button"
          disabled={page >= totalPages - 1 || listQuery.isLoading}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

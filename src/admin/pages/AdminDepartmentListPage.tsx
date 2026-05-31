import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Building2, Crown, Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminDepartmentService } from '../../api/services/adminDepartmentService';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { PERMISSION_MODULE_PREFIX_VI } from '../../lib/permissionCatalog';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import type { DepartmentDto } from '../../api/types/department.types';

const card = 'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';

// Gom permission codes thành nhãn module
function permissionSummary(codes: number[]): string {
  if (!codes || codes.length === 0) return 'Chưa cấp quyền';
  const modules = new Set<number>();
  codes.forEach((c) => {
    const prefix = Math.floor(c / 1000);
    if (prefix > 0) modules.add(prefix);
  });
  return Array.from(modules)
    .map((p) => PERMISSION_MODULE_PREFIX_VI[p] ?? `Module ${p}`)
    .join(', ');
}

const DEPT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function AdminDepartmentListPage() {
  const canCreate = adminAccessControlUi.canViewDepartments();
  const canDelete = adminAccessControlUi.canViewDepartments();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminDepartmentService.list(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDepartmentService.delete(id),
    onSuccess: () => {
      toast.success('Đã xoá phòng ban');
      void queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Xoá thất bại');
      setDeletingId(null);
    },
  });

  const departments: DepartmentDto[] = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PricingPageHeader title="Phòng ban" />
        {canCreate && (
          <Link
            to="/admin/departments/create"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="size-4" />
            Tạo phòng ban
          </Link>
        )}
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        Mỗi phòng ban được cấp tập hợp quyền. Nhân viên được gán vào phòng ban sẽ tự động nhận quyền đó.
      </p>

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={clsx(card, 'h-44 animate-pulse bg-[var(--bg-elevated)]')} />
          ))}
        </div>
      ) : listQuery.isError ? (
        <p className="text-sm text-[var(--danger)]">
          {listQuery.error instanceof Error ? listQuery.error.message : 'Lỗi tải danh sách'}
        </p>
      ) : departments.length === 0 ? (
        <div className={clsx(card, 'flex flex-col items-center gap-4 py-16 text-center')}>
          <Building2 className="size-12 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Chưa có phòng ban nào. Tạo phòng ban đầu tiên.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => {
            const color = dept.color ?? DEPT_COLORS[dept.id % DEPT_COLORS.length];
            return (
              <div key={dept.id} className={clsx(card, 'flex flex-col overflow-hidden')}>
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-9 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: color }}
                      >
                        <Building2 className="size-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{dept.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          <Users className="mr-1 inline size-3" />
                          {dept.member_count ?? 0} thành viên
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Link
                        to={`/admin/departments/${dept.id}/edit`}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--accent)]"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingId(dept.id)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {dept.description && (
                    <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{dept.description}</p>
                  )}

                  {dept.leader_name && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Crown className="size-3.5 text-amber-500" />
                      <span>Leader: <span className="font-medium text-[var(--text-primary)]">{dept.leader_name}</span></span>
                    </div>
                  )}

                  <div className="mt-auto">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Quyền được cấp
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {permissionSummary(dept.permission_codes)}
                    </p>
                  </div>

                  <Link
                    to={`/admin/departments/${dept.id}/members`}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    <Users className="size-3.5" />
                    Quản lý thành viên
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className={clsx(card, 'w-full max-w-sm p-6')}>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Xác nhận xoá phòng ban</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Xoá phòng ban sẽ xoá toàn bộ thành viên khỏi phòng ban này.
              Thao tác không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
                className="rounded-xl border border-[var(--bg-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Đang xoá…' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

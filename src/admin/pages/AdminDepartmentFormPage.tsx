import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowLeft, Building2, Check, Crown, UserMinus, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminDepartmentService } from '../../api/services/adminDepartmentService';
import { adminPermissionCatalogService } from '../../api/services/adminPermissionCatalogService';
import { adminStaffService } from '../../api/services/adminStaffEmployeeService';
import {
  flattenPermissionCatalog,
  isAssignablePermissionCodeViaUi,
  PERMISSION_MODULE_PREFIX_VI,
} from '../../lib/permissionCatalog';
import { getApiErrorMessage } from '../../utils/apiError';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import type { DepartmentDto } from '../../api/types/department.types';
import type { AdminUserResponse } from '../../api/types/adminAccessControl.types';

const card = 'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';

const DEPT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

// ── Predefined department templates ──────────────────────────────────────────
const DEPT_PRESETS = [
  {
    label: 'Phòng Nhân sự',
    color: '#3B82F6',
    description: 'Quản lý nhân sự, tài liệu và báo cáo nội bộ.',
    codes: [700001, 700002, 700003, 700004, 300001, 300002, 600001, 600002],
  },
  {
    label: 'Phòng Ngành hàng',
    color: '#10B981',
    description: 'Quản lý sản phẩm, đơn hàng, trả hàng và kho.',
    codes: [100001, 100002, 100003, 100004, 500001, 500002, 500003, 500004],
  },
  {
    label: 'Phòng Marketing',
    color: '#F59E0B',
    description: 'Quản lý giá và chương trình khuyến mãi.',
    codes: [100002, 150001, 150002, 150003, 150004],
  },
];

// Group by module prefix
function groupByModule(codes: number[]): Record<number, number[]> {
  const groups: Record<number, number[]> = {};
  codes.forEach((c) => {
    const prefix = Math.floor(c / 1000);
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(c);
  });
  return groups;
}

const ACTION_LABELS: Record<number, string> = {
  1: 'Tạo', 2: 'Xem', 3: 'Sửa', 4: 'Xoá',
};

export default function AdminDepartmentFormPage() {
  const { deptId } = useParams<{ deptId?: string }>();
  const { pathname } = useLocation();
  const isMembers = pathname.endsWith('/members');
  const isEdit = !isMembers && deptId != null;
  const numId = deptId ? Number(deptId) : NaN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPT_COLORS[0]);
  const [selectedCodes, setSelectedCodes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // ── Members state ─────────────────────────────────────────────────────────
  const [memberSearch, setMemberSearch] = useState('');
  const [addPosition, setAddPosition] = useState<'LEADER' | 'MEMBER'>('MEMBER');

  // ── Load existing if edit / members ──────────────────────────────────────
  const deptQuery = useQuery({
    queryKey: ['admin-department', numId],
    queryFn: () => adminDepartmentService.getById(numId),
    enabled: Number.isFinite(numId),
  });

  useEffect(() => {
    const d: DepartmentDto | undefined = deptQuery.data;
    if (!d) return;
    setName(d.name);
    setDescription(d.description ?? '');
    setColor(d.color ?? DEPT_COLORS[0]);
    setSelectedCodes(new Set(d.permission_codes ?? []));
  }, [deptQuery.data]);

  // ── Permission catalog ────────────────────────────────────────────────────
  const catalogQuery = useQuery({
    queryKey: ['admin-permission-catalog'],
    queryFn: ({ signal }) => adminPermissionCatalogService.getCatalog(signal),
    staleTime: 5 * 60_000,
  });
  const allEntries = useMemo(
    () => flattenPermissionCatalog(catalogQuery.data).filter((e) => isAssignablePermissionCodeViaUi(e.code)),
    [catalogQuery.data]
  );
  const moduleGroups = useMemo(() => groupByModule(allEntries.map((e) => e.code)), [allEntries]);

  // ── Staff list for member assignment ─────────────────────────────────────
  const staffQuery = useQuery({
    queryKey: ['admin-personnel-list', 'staff', 0, 200],
    queryFn: ({ signal }) => adminStaffService.listPaged(0, 200, signal),
    enabled: isMembers,
    staleTime: 30_000,
  });

  const memberIds = useMemo(
    () => new Set((deptQuery.data?.members ?? []).map((m) => m.user_id)),
    [deptQuery.data]
  );

  const filteredStaff = useMemo<AdminUserResponse[]>(() => {
    const all: AdminUserResponse[] = staffQuery.data?.items ?? [];
    const q = memberSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (u) =>
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    );
  }, [staffQuery.data, memberSearch]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        permissionCodes: Array.from(selectedCodes),
      };
      return isEdit
        ? adminDepartmentService.update(numId, body)
        : adminDepartmentService.create(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật phòng ban' : 'Đã tạo phòng ban');
      void queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      navigate('/admin/departments');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Lưu thất bại')),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ userId, position }: { userId: number; position: 'LEADER' | 'MEMBER' }) =>
      adminDepartmentService.addMember(numId, userId, position),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-department', numId] });
      toast.success('Đã thêm thành viên');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Thêm thất bại')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => adminDepartmentService.removeMember(numId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-department', numId] });
      toast.success('Đã xoá thành viên');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Xoá thất bại')),
  });

  const toggleCode = (code: number) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const applyPreset = (preset: typeof DEPT_PRESETS[number]) => {
    setName(preset.label);
    setDescription(preset.description);
    setColor(preset.color);
    setSelectedCodes(new Set(preset.codes));
  };

  const title = isMembers
    ? `Thành viên — ${deptQuery.data?.name ?? '...'}`
    : isEdit
    ? `Chỉnh sửa phòng ban`
    : 'Tạo phòng ban mới';

  // ── Members view ──────────────────────────────────────────────────────────
  if (isMembers) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/departments" className="text-sm font-semibold text-[var(--accent)] hover:opacity-75">
            <ArrowLeft className="mr-1 inline size-4" />Phòng ban
          </Link>
        </div>
        <PricingPageHeader title={title} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current members */}
          <div className={clsx(card, 'p-5')}>
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              Thành viên hiện tại ({deptQuery.data?.members?.length ?? 0})
            </p>
            {deptQuery.isLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Đang tải…</p>
            ) : (deptQuery.data?.members ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Chưa có thành viên.</p>
            ) : (
              <ul className="divide-y divide-[var(--bg-border)]">
                {(deptQuery.data?.members ?? []).map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {m.position === 'LEADER' && (
                          <Crown className="size-3.5 shrink-0 text-amber-500" />
                        )}
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {m.full_name || m.username}
                        </p>
                      </div>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {m.username}
                        {m.position === 'LEADER' && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Leader
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={removeMemberMutation.isPending}
                      onClick={() => removeMemberMutation.mutate(m.user_id)}
                      className="shrink-0 rounded-lg p-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add members */}
          <div className={clsx(card, 'p-5')}>
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Thêm nhân viên</p>

            {/* Position selector */}
            <div className="mb-3 flex gap-2">
              {(['MEMBER', 'LEADER'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setAddPosition(pos)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                    addPosition === pos
                      ? pos === 'LEADER'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border border-[var(--bg-border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]',
                  )}
                >
                  {pos === 'LEADER' && <Crown className="size-3" />}
                  {pos === 'LEADER' ? 'Thêm làm Leader' : 'Thêm làm Thành viên'}
                </button>
              ))}
            </div>

            {addPosition === 'LEADER' && (
              <p className="mb-2 rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                ⚠️ Mỗi phòng ban chỉ có 1 Leader. Nếu đã có Leader, hãy xoá Leader cũ trước.
              </p>
            )}

            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Tìm theo username / email…"
              className="mb-3 w-full rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            {staffQuery.isLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Đang tải…</p>
            ) : (
              <ul className="max-h-72 divide-y divide-[var(--bg-border)] overflow-y-auto">
                {filteredStaff.map((u) => {
                  const isMember = memberIds.has(u.id);
                  return (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{u.username}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{u.email}</p>
                      </div>
                      {isMember ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--success)]">
                          <Check className="size-3.5" /> Đã có
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={addMemberMutation.isPending}
                          onClick={() => addMemberMutation.mutate({ userId: u.id, position: addPosition })}
                          className={clsx(
                            'shrink-0 rounded-lg p-1.5 disabled:opacity-50',
                            addPosition === 'LEADER'
                              ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                              : 'text-[var(--accent)] hover:bg-[var(--accent-soft)]',
                          )}
                        >
                          <UserPlus className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Create / Edit view ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/departments" className="text-sm font-semibold text-[var(--accent)] hover:opacity-75">
          <ArrowLeft className="mr-1 inline size-4" />Phòng ban
        </Link>
      </div>
      <PricingPageHeader title={title} />

      {/* Preset templates */}
      {!isEdit && (
        <div className={clsx(card, 'p-5')}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Mẫu phòng ban có sẵn
          </p>
          <div className="flex flex-wrap gap-2">
            {DEPT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bg-border)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}
              >
                <Building2 className="size-3.5" style={{ color: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: form info */}
        <div className={clsx(card, 'space-y-5 p-6')}>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
              Tên phòng ban <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Phòng Nhân sự"
              maxLength={100}
              className="w-full rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Mô tả chức năng của phòng ban…"
              className="w-full resize-none rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">Màu nhận diện</label>
            <div className="flex flex-wrap gap-2">
              {DEPT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx(
                    'size-7 rounded-full transition-transform hover:scale-110',
                    color === c && 'ring-2 ring-offset-2 ring-[var(--accent)]'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: permission matrix */}
        <div className={clsx(card, 'p-5')}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Quyền cấp cho thành viên ({selectedCodes.size})
          </p>
          {catalogQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Đang tải quyền…</p>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {Object.entries(moduleGroups)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([prefixStr, codes]) => {
                  const prefix = Number(prefixStr);
                  const moduleLabel = PERMISSION_MODULE_PREFIX_VI[prefix] ?? `Module ${prefix}`;
                  const allSelected = codes.every((c) => selectedCodes.has(c));
                  return (
                    <div key={prefix} className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{moduleLabel}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCodes((prev) => {
                              const next = new Set(prev);
                              if (allSelected) codes.forEach((c) => next.delete(c));
                              else codes.forEach((c) => next.add(c));
                              return next;
                            });
                          }}
                          className="text-[10px] font-medium text-[var(--accent)] hover:underline"
                        >
                          {allSelected ? 'Bỏ tất cả' : 'Chọn tất cả'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {codes
                          .sort((a, b) => (a % 1000) - (b % 1000))
                          .map((code) => {
                            const action = code % 1000;
                            const checked = selectedCodes.has(code);
                            return (
                              <button
                                key={code}
                                type="button"
                                onClick={() => toggleCode(code)}
                                className={clsx(
                                  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                                  checked
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                                )}
                              >
                                {checked && <Check className="size-2.5" />}
                                {ACTION_LABELS[action] ?? `#${action}`}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          to="/admin/departments"
          className="rounded-xl border border-[var(--bg-border)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          Huỷ
        </Link>
        <button
          type="button"
          disabled={!name.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Tạo phòng ban'}
        </button>
      </div>
    </div>
  );
}

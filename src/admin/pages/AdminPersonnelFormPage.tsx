import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { authService } from '../../api/services/authService';
import { adminRoleService } from '../../api/services/adminRoleService';
import { adminPermissionCatalogService } from '../../api/services/adminPermissionCatalogService';
import { adminUserManagementService } from '../../api/services/adminUserManagementService';
import {
  adminCustomerService,
  adminEmployeeService,
  adminStaffService,
} from '../../api/services/adminStaffEmployeeService';
import type {
  AdminPersonnelSegment,
  AdminUserResponse,
  CreateStaffEmployeeUserRequest,
  RoleResponse,
  StaffEmployeeModUserInfoRequest,
} from '../../api/types/adminAccessControl.types';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { isCustomerRoleCode, isEmployeeRoleCode, normalizeRoleCode } from '../../lib/personnelSegment';
import {
  buildPermissionMatrixRows,
  effectiveSetHasAnyEquivalent,
  flattenPermissionCatalog,
  isAssignablePermissionCodeViaUi,
} from '../../lib/permissionCatalog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';
import { PermissionCrudMatrixEditor } from '../components/access/PermissionCrudMatrixEditor';

const segmentUi: Record<
  AdminPersonnelSegment,
  { basePath: string; listLabel: string; docHint: string; createTitle: string; editTitle: (id: number) => string }
> = {
  staff: {
    basePath: '/admin/staff',
    listLabel: 'Danh sách nhân viên nội bộ',
    docHint: 'Quản lý tài khoản nhân viên nội bộ. Có thể gán chức vụ và đặt lại mật khẩu.',
    createTitle: 'Tạo nhân viên nội bộ',
    editTitle: (id) => `Sửa nhân viên nội bộ #${id}`,
  },
  employee: {
    basePath: '/admin/employees',
    listLabel: 'Danh sách nhân viên',
    docHint: 'Quản lý tài khoản nhân viên cửa hàng.',
    createTitle: 'Tạo nhân viên',
    editTitle: (id) => `Sửa nhân viên #${id}`,
  },
  customer: {
    basePath: '/admin/customers',
    listLabel: 'Danh sách khách hàng',
    docHint: 'Danh sách khách hàng đã đăng ký. Chỉ xem, không chỉnh sửa.',
    createTitle: '',
    editTitle: (id) => `Chi tiết khách hàng #${id}`,
  },
};

function roleOptionsForEditor(all: RoleResponse[]): RoleResponse[] {
  if (adminAccessControlUi.canAssignSuperRoles()) return all;
  const blocked = new Set(['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN']);
  const allow = adminAccessControlUi.allowedRoleCodesForCreate();
  if (!allow) return all.filter((r) => !blocked.has(r.code));
  return all.filter(
    (r) => !blocked.has(r.code) && (allow.has(r.code) || allow.has(`ROLE_${r.code}`))
  );
}

function resolveRoleIdFromUser(u: AdminUserResponse, roles: RoleResponse[]): string {
  const fromIds = u.roleIds?.[0];
  if (fromIds != null) return String(fromIds);
  const code = u.roles?.[0];
  if (!code) return '';
  const norm = normalizeRoleCode(code);
  const match = roles.find(
    (r) => r.code === code || normalizeRoleCode(r.code) === norm || r.code === `ROLE_${norm}`
  );
  return match != null ? String(match.id) : '';
}

type CreateForm = {
  username: string;
  password: string;
  phoneNumber: string;
  email: string;
  fullName: string;
  roleId: string;
};

function emptyCreate(): CreateForm {
  return { username: '', password: '', phoneNumber: '', email: '', fullName: '', roleId: '' };
}

type EditForm = {
  email: string;
  phoneNumber: string;
  fullName: string;
  telephone: string;
  managerId: string;
  status: number;
  roleId: string;
  password: string;
};

function mapUserToEdit(u: AdminUserResponse, roles: RoleResponse[]): EditForm {
  return {
    email: u.email ?? '',
    phoneNumber: u.phoneNumber ?? '',
    fullName: u.userInfo?.fullName ?? '',
    telephone: u.userInfo?.telephone ?? '',
    managerId: u.userInfo?.managerId != null ? String(u.userInfo.managerId) : '',
    status: u.status ?? 1,
    roleId: resolveRoleIdFromUser(u, roles),
    password: '',
  };
}

async function fetchPersonnelDetail(
  variant: AdminPersonnelSegment,
  id: number,
  signal?: AbortSignal
): Promise<AdminUserResponse> {
  if (variant === 'customer') return adminCustomerService.getById(id, signal);
  if (variant === 'employee') return adminEmployeeService.getById(id, signal);
  return adminStaffService.getById(id, signal);
}

type Props = { variant: AdminPersonnelSegment };

export default function AdminPersonnelFormPage({ variant }: Props) {
  const { userId: userIdParam } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = authService.getCurrentUser();
  const ui = segmentUi[variant];

  const isCreate = userIdParam == null;
  const userId = userIdParam != null ? Number(userIdParam) : NaN;
  const isValidEditId = Number.isFinite(userId) && userId > 0;

  const canCreate = adminAccessControlUi.createUser();
  const canUpdate = adminAccessControlUi.updateUser();
  const canLock = adminAccessControlUi.lockUser();
  const canGrant = adminAccessControlUi.grantOrRevokePermission();
  const canList = adminAccessControlUi.listUsers();

  const canDelete = adminAccessControlUi.deleteUser();

  const isCustomerReadOnly = variant === 'customer' && !isCreate;

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(null);

  const rolesEnabled =
    canList &&
    variant !== 'customer' &&
    ((isCreate && canCreate) || (!isCreate && isValidEditId && (canUpdate || canGrant)));

  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => adminRoleService.list(signal),
    staleTime: 60_000,
    enabled: rolesEnabled,
  });

  const catalogEnabled =
    canList &&
    variant !== 'customer' &&
    ((isCreate && canCreate) || (!isCreate && isValidEditId));

  const catalogQuery = useQuery({
    queryKey: ['admin-permissions-catalog'],
    queryFn: ({ signal }) => adminPermissionCatalogService.getCatalog(signal),
    staleTime: 120_000,
    enabled: catalogEnabled,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-personnel-detail', variant, userId],
    queryFn: ({ signal }) => fetchPersonnelDetail(variant, userId, signal),
    enabled: !isCreate && isValidEditId && canList,
  });

  const permsQuery = useQuery({
    queryKey: ['admin-user-permissions', userId],
    queryFn: ({ signal }) => adminUserManagementService.getUserPermissions(userId, signal),
    enabled: !isCreate && isValidEditId && canList && variant !== 'customer',
  });

  const myPermsQuery = useQuery({
    queryKey: ['admin-user-permissions', me?.id],
    queryFn: ({ signal }) => adminUserManagementService.getUserPermissions(me!.id, signal),
    enabled: !isCreate && canGrant && me?.id != null && isValidEditId && variant !== 'customer',
  });

  const editorRoles = useMemo(
    () => roleOptionsForEditor(rolesQuery.data ?? []),
    [rolesQuery.data]
  );

  const roleChoices = useMemo(() => {
    const nonCustomer = editorRoles.filter((r) => !isCustomerRoleCode(r.code));
    if (variant === 'employee') return nonCustomer.filter((r) => isEmployeeRoleCode(r.code));
    return nonCustomer;
  }, [editorRoles, variant]);

  useEffect(() => {
    if (!isCreate || variant !== 'employee') return;
    setCreateForm((p) => {
      if (p.roleId.trim()) return p;
      const emp = roleChoices.find((r) => isEmployeeRoleCode(r.code));
      if (!emp) return p;
      return { ...p, roleId: String(emp.id) };
    });
  }, [isCreate, variant, roleChoices]);

  useEffect(() => {
    if (!detailQuery.data) {
      setEditForm(null);
      return;
    }
    if (variant !== 'customer' && !rolesQuery.data) return;
    setEditForm(mapUserToEdit(detailQuery.data, rolesQuery.data ?? []));
  }, [detailQuery.data, rolesQuery.data, variant]);

  const catalogEntries = useMemo(() => {
    const flat = flattenPermissionCatalog(catalogQuery.data ?? null);
    return flat.filter((e) => isAssignablePermissionCodeViaUi(e.code));
  }, [catalogQuery.data]);

  const matrixRows = useMemo(() => buildPermissionMatrixRows(catalogEntries), [catalogEntries]);

  const effectiveSet = useMemo(
    () => new Set(permsQuery.data?.effectivePermissions ?? []),
    [permsQuery.data?.effectivePermissions]
  );
  const rolePermissionSet = useMemo(
    () => new Set(permsQuery.data?.rolePermissions ?? []),
    [permsQuery.data?.rolePermissions]
  );
  const userPermissionSet = useMemo(
    () => new Set(permsQuery.data?.userPermissions ?? []),
    [permsQuery.data?.userPermissions]
  );

  const assignableByPolicy = useCallback((code: number) => {
    if (!isAssignablePermissionCodeViaUi(code)) return false;
    const broad = authService.hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN']);
    if (broad) return true;
    const eff = new Set(myPermsQuery.data?.effectivePermissions ?? []);
    return effectiveSetHasAnyEquivalent(eff, code);
  }, [myPermsQuery.data]);

  const invalidateLists = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-personnel-list'] });
  }, [queryClient]);

  const onCreate = useCallback(async () => {
    if (variant === 'customer') return;
    const username = createForm.username.trim();
    const phoneNumber = createForm.phoneNumber.trim();
    if (!username) {
      notify.error('Username là bắt buộc.');
      return;
    }
    if (!phoneNumber) {
      notify.error('Số điện thoại là bắt buộc.');
      return;
    }
    setCreateSaving(true);
    try {
      const body: CreateStaffEmployeeUserRequest = {
        username,
        phoneNumber,
        email: createForm.email.trim() || undefined,
        fullName: createForm.fullName.trim() || undefined,
      };
      const pw = createForm.password.trim();
      if (pw) body.password = pw;
      if (createForm.roleId.trim()) {
        const rid = Number(createForm.roleId.trim());
        if (Number.isFinite(rid)) body.roleId = rid;
      }
      const created =
        variant === 'employee' ? await adminEmployeeService.create(body) : await adminStaffService.create(body);
      notify.success(variant === 'employee' ? 'Đã tạo nhân viên mới' : 'Đã tạo nhân viên nội bộ mới');
      if (created.temporaryPassword) setTempPasswordModal(created.temporaryPassword);
      await invalidateLists();
      navigate(`${ui.basePath}/${created.id}/edit`, { replace: true });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Tạo thất bại'));
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, invalidateLists, navigate, ui.basePath, variant]);

  const onSaveDetail = useCallback(async () => {
    if (!isValidEditId || editForm == null || isCustomerReadOnly) return;
    if (!canUpdate) {
      notify.error('Không có quyền cập nhật.');
      return;
    }
    setDetailSaving(true);
    try {
      const body: StaffEmployeeModUserInfoRequest = {
        id: userId,
        email: editForm.email.trim() || undefined,
        phoneNumber: editForm.phoneNumber.trim() || undefined,
        fullName: editForm.fullName.trim() || undefined,
        telephone: editForm.telephone.trim() || undefined,
        status: editForm.status,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();
      if (editForm.roleId.trim()) {
        const rid = Number(editForm.roleId.trim());
        if (Number.isFinite(rid)) body.roleId = rid;
      }
      if (adminAccessControlUi.canAssignSuperRoles()) {
        if (editForm.managerId.trim()) {
          const n = Number(editForm.managerId.trim());
          if (Number.isFinite(n)) body.managerId = n;
        }
      }
      const updateFn = variant === 'employee' ? adminEmployeeService.update : adminStaffService.update;
      await updateFn(body);
      notify.success('Đã cập nhật');
      await invalidateLists();
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-detail', variant, userId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-user-permissions', userId] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Cập nhật thất bại'));
    } finally {
      setDetailSaving(false);
    }
  }, [
    userId,
    editForm,
    canUpdate,
    isValidEditId,
    invalidateLists,
    queryClient,
    variant,
    isCustomerReadOnly,
  ]);

  const onToggleLock = useCallback(async () => {
    if (!isValidEditId || editForm == null || isCustomerReadOnly) return;
    if (!canLock) {
      notify.error('Không có quyền khóa / mở tài khoản.');
      return;
    }
    const nextStatus = editForm.status === 1 ? 0 : 1;
    const updateFn = variant === 'employee' ? adminEmployeeService.update : adminStaffService.update;
    setDetailSaving(true);
    try {
      await updateFn({ id: userId, status: nextStatus });
      notify.success(nextStatus === 1 ? 'Đã mở tài khoản' : 'Đã khóa tài khoản');
      setEditForm((f) => (f ? { ...f, status: nextStatus } : f));
      await invalidateLists();
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-detail', variant, userId] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Thao tác thất bại'));
    } finally {
      setDetailSaving(false);
    }
  }, [
    userId,
    editForm,
    canLock,
    isValidEditId,
    invalidateLists,
    queryClient,
    variant,
    isCustomerReadOnly,
  ]);

  const onResetPassword = useCallback(async () => {
    if (!isValidEditId || variant !== 'staff' || !canUpdate) return;
    setResetBusy(true);
    try {
      const res = await adminStaffService.resetPassword(userId);
      if (res.temporaryPassword) setTempPasswordModal(res.temporaryPassword);
      else notify.success('Đã đặt lại mật khẩu');
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-detail', variant, userId] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Đặt lại mật khẩu thất bại'));
    } finally {
      setResetBusy(false);
    }
  }, [userId, isValidEditId, variant, canUpdate, queryClient]);

  const onDeleteStaff = useCallback(async () => {
    if (!isValidEditId || variant !== 'staff' || !canDelete) return;
    if (!window.confirm(`Xóa nhân viên nội bộ #${userId}? Thao tác này không thể hoàn tác.`)) return;
    setDeleteBusy(true);
    try {
      await adminStaffService.delete(userId);
      notify.success('Đã xóa');
      await invalidateLists();
      navigate(ui.basePath);
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Xóa thất bại'));
    } finally {
      setDeleteBusy(false);
    }
  }, [userId, isValidEditId, variant, canDelete, invalidateLists, navigate, ui.basePath]);

  const onGrantCodes = useCallback(
    async (codes: number[]) => {
      if (!isValidEditId || codes.length === 0 || !canGrant || isCustomerReadOnly) return;
      setPermBusy(true);
      try {
        await adminUserManagementService.grantPermissions({ userId, permissionCodes: codes, expiresAt: null });
        notify.success('Đã cấp quyền');
        await queryClient.invalidateQueries({ queryKey: ['admin-user-permissions', userId] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Cấp quyền thất bại'));
      } finally {
        setPermBusy(false);
      }
    },
    [userId, canGrant, isValidEditId, queryClient, isCustomerReadOnly]
  );

  const onRevokeCodes = useCallback(
    async (codes: number[]) => {
      if (!isValidEditId || codes.length === 0 || !canGrant || isCustomerReadOnly) return;
      setPermBusy(true);
      try {
        await adminUserManagementService.revokePermissions({ userId, permissionCodes: codes });
        notify.success('Đã thu hồi quyền');
        await queryClient.invalidateQueries({ queryKey: ['admin-user-permissions', userId] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Thu hồi thất bại'));
      } finally {
        setPermBusy(false);
      }
    },
    [userId, canGrant, isValidEditId, queryClient, isCustomerReadOnly]
  );

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  if (!canList) {
    return (
      <div className="space-y-4">
        <Link
          to={ui.basePath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Về danh sách
        </Link>
        <p className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm text-[var(--text-secondary)]">
          Không có quyền xem / thao tác.
        </p>
      </div>
    );
  }

  if (variant === 'customer' && isCreate) {
    return <Navigate to={ui.basePath} replace />;
  }

  if (isCreate && !canCreate) {
    return (
      <div className="space-y-4">
        <Link
          to={ui.basePath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Về danh sách
        </Link>
        <p className="text-sm text-[var(--text-secondary)]">Bạn không có quyền tạo tài khoản.</p>
      </div>
    );
  }

  if (!isCreate && !isValidEditId) {
    return (
      <div className="space-y-4">
        <Link
          to={ui.basePath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Về danh sách
        </Link>
        <p className="text-sm text-[var(--danger)]">ID không hợp lệ.</p>
      </div>
    );
  }

  const pageTitle = isCreate ? ui.createTitle : ui.editTitle(userId);

  const fieldDisabled = isCustomerReadOnly || !canUpdate;

  const showEditForm =
    !isCreate && editForm != null && !detailQuery.isLoading && !detailQuery.isError;

  return (
    <div className="space-y-8">
      {tempPasswordModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="temp-pass-title"
        >
          <div className="max-w-md rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
            <h2 id="temp-pass-title" className="text-base font-semibold text-[var(--text-primary)]">
              Mật khẩu tạm (chỉ hiển thị một lần)
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Sao chép và gửi cho nhân viên; không lưu log trên máy khách.
            </p>
            <div className="mt-4 rounded-lg bg-[var(--bg-elevated)] px-3 py-2 font-mono text-lg tracking-widest text-[var(--text-primary)]">
              {tempPasswordModal}
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              onClick={() => setTempPasswordModal(null)}
            >
              Đã lưu / đã gửi
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={ui.basePath}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {ui.listLabel}
          </Link>
          <PricingPageHeader title={pageTitle} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">{ui.docHint}</p>
        </div>
        {!isCreate && showEditForm && editForm ? (
          <div className="flex flex-wrap items-center gap-2">
            {(editForm.status ?? 1) === 1 ? (
              <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
            ) : (
              <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
            )}
            {!isCustomerReadOnly && canLock ? (
              <button
                type="button"
                disabled={detailSaving}
                onClick={() => void onToggleLock()}
                className={clsx(
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  editForm.status === 1
                    ? 'border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/15'
                    : 'bg-[var(--accent)] text-white hover:brightness-110'
                )}
              >
                {editForm.status === 1 ? 'Khóa tài khoản' : 'Mở tài khoản'}
              </button>
            ) : null}
            {!isCustomerReadOnly && variant === 'staff' && canUpdate ? (
              <button
                type="button"
                disabled={resetBusy || detailSaving}
                onClick={() => void onResetPassword()}
                className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {resetBusy ? 'Đang xử lý…' : 'Đặt lại MK (6 số)'}
              </button>
            ) : null}
            {!isCustomerReadOnly && variant === 'staff' && canDelete ? (
              <button
                type="button"
                disabled={deleteBusy || detailSaving}
                onClick={() => void onDeleteStaff()}
                className="rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/15 disabled:opacity-50"
              >
                {deleteBusy ? 'Đang xóa…' : 'Xóa staff'}
              </button>
            ) : null}
            {!isCustomerReadOnly && canUpdate ? (
              <button
                type="button"
                disabled={detailSaving}
                onClick={() => void onSaveDetail()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {detailSaving ? 'Đang lưu…' : 'Lưu thông tin'}
              </button>
            ) : null}
          </div>
        ) : isCreate ? (
          <button
            type="button"
            disabled={createSaving}
            onClick={() => void onCreate()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {createSaving ? 'Đang tạo…' : 'Tạo'}
          </button>
        ) : null}
      </div>

      <section className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Thông tin tài khoản</h2>

        {isCreate ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Username *
              <input
                className={inputCls}
                value={createForm.username}
                onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Mật khẩu (tuỳ chọn)
              <input
                type="password"
                className={inputCls}
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Để trống — backend sinh 6 số"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Số điện thoại *
              <input
                className={inputCls}
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm((p) => ({ ...p, phoneNumber: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Email
              <input
                type="email"
                className={inputCls}
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">
              Họ tên
              <input
                className={inputCls}
                value={createForm.fullName}
                onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">
              <span>Chức vụ</span>
              <span className="font-normal text-[10px] text-[var(--text-muted)]">
                {variant === 'employee'
                  ? 'Chỉ vai trò Nhân viên được hỗ trợ cho loại tài khoản này.'
                  : 'Để trống để hệ thống tự gán mặc định.'}
              </span>
              <select
                className={inputCls}
                value={createForm.roleId}
                onChange={(e) => setCreateForm((p) => ({ ...p, roleId: e.target.value }))}
              >
                <option value="">—</option>
                {roleChoices.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : detailQuery.isLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Đang tải…</p>
        ) : detailQuery.isError ? (
          <p className="text-sm text-[var(--danger)]">{getApiErrorMessage(detailQuery.error, 'Không tải được')}</p>
        ) : editForm ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Username</span>
              <span className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 px-3 py-2 text-sm text-[var(--text-primary)]">
                {detailQuery.data?.username ?? '—'}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Email
              <input
                className={inputCls}
                value={editForm.email}
                onChange={(e) => setEditForm((f) => (f ? { ...f, email: e.target.value } : f))}
                disabled={fieldDisabled}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Điện thoại
              <input
                className={inputCls}
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((f) => (f ? { ...f, phoneNumber: e.target.value } : f))}
                disabled={fieldDisabled}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Họ tên
              <input
                className={inputCls}
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => (f ? { ...f, fullName: e.target.value } : f))}
                disabled={fieldDisabled}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Điện thoại (user_info)
              <input
                className={inputCls}
                value={editForm.telephone}
                onChange={(e) => setEditForm((f) => (f ? { ...f, telephone: e.target.value } : f))}
                disabled={fieldDisabled}
              />
            </label>
            {!isCustomerReadOnly ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                Mật khẩu mới (tuỳ chọn)
                <input
                  type="password"
                  className={inputCls}
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, password: e.target.value } : f))}
                  disabled={fieldDisabled}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Trạng thái
              <select
                className={inputCls}
                value={String(editForm.status)}
                onChange={(e) => setEditForm((f) => (f ? { ...f, status: Number(e.target.value) } : f))}
                disabled={fieldDisabled}
              >
                <option value="1">{ADMIN_RECORD_STATUS_LABEL_VI.active}</option>
                <option value="0">{ADMIN_RECORD_STATUS_LABEL_VI.inactive}</option>
              </select>
            </label>
            {!isCustomerReadOnly && adminAccessControlUi.canAssignSuperRoles() ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                Quản lý
                <input
                  className={inputCls}
                  value={editForm.managerId}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, managerId: e.target.value } : f))}
                  disabled={fieldDisabled}
                />
              </label>
            ) : null}
            {!isCustomerReadOnly ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">
                Chức vụ
                <select
                  className={inputCls}
                  value={editForm.roleId}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, roleId: e.target.value } : f))}
                  disabled={fieldDisabled}
                >
                  <option value="">— Giữ nguyên —</option>
                  {roleChoices.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </section>

      {!isCreate && detailQuery.data ? (
        <section className="space-y-4 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Hồ sơ</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Roles</p>
              <p className="text-[var(--text-primary)]">{(detailQuery.data.roles ?? []).join(', ') || '—'}</p>
            </div>
            {detailQuery.data.userInfo?.avatar ? (
              <div className="sm:col-span-2">
                <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">Ảnh đại diện</p>
                <img
                  src={detailQuery.data.userInfo.avatar}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-[var(--bg-border)] object-cover"
                />
              </div>
            ) : null}
          </div>
          {detailQuery.data.defaultAddress ? (
            <div className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/30 p-4 text-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Địa chỉ mặc định
              </h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-[11px] text-[var(--text-muted)]">Địa chỉ</dt>
                  <dd className="text-[var(--text-primary)]">{detailQuery.data.defaultAddress.addressLine}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Tỉnh / TP</dt>
                  <dd>{detailQuery.data.defaultAddress.city}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Quận / Bang</dt>
                  <dd>{detailQuery.data.defaultAddress.state ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Quốc gia</dt>
                  <dd>{detailQuery.data.defaultAddress.country}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Loại</dt>
                  <dd>{detailQuery.data.defaultAddress.addressType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Khoảng cách kho (m)</dt>
                  <dd>
                    {detailQuery.data.defaultAddress.distanceToWarehouseMeters != null
                      ? String(detailQuery.data.defaultAddress.distanceToWarehouseMeters)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Phí ship gợi ý (VND)</dt>
                  <dd>
                    {detailQuery.data.defaultAddress.shippingFeeVnd != null
                      ? new Intl.NumberFormat('vi-VN').format(detailQuery.data.defaultAddress.shippingFeeVnd)
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Chưa có địa chỉ mặc định.</p>
          )}
        </section>
      ) : null}

      {variant !== 'customer' ? (
        <section className="space-y-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Bảng quyền hệ thống</h2>
          {catalogQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Đang tải catalog…</p>
          ) : catalogQuery.isError ? (
            <p className="text-sm text-[var(--danger)]">{getApiErrorMessage(catalogQuery.error, 'Lỗi catalog')}</p>
          ) : isCreate ? (
            <>
              <p className="mb-2 text-sm text-[var(--text-secondary)]">
                Sau khi tạo user, mỗi quyền cấp thêm là <strong>một dòng — một mã</strong>; một lần chỉ thao tác một mã.
              </p>
              <PermissionCrudMatrixEditor
                rows={matrixRows}
                effectiveSet={new Set()}
                rolePermissionSet={new Set()}
                userPermissionSet={new Set()}
                canMutate={false}
                isCodeAssignable={assignableByPolicy}
                busy={false}
                onGrantCodes={async () => {}}
                onRevokeCodes={async () => {}}
              />
            </>
          ) : permsQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Đang tải quyền user…</p>
          ) : permsQuery.isError ? (
            <p className="text-sm text-[var(--danger)]">{getApiErrorMessage(permsQuery.error, 'Lỗi quyền')}</p>
          ) : (
            <PermissionCrudMatrixEditor
              rows={matrixRows}
              effectiveSet={effectiveSet}
              rolePermissionSet={rolePermissionSet}
              userPermissionSet={userPermissionSet}
              canMutate={canGrant}
              isCodeAssignable={assignableByPolicy}
              busy={permBusy}
              onGrantCodes={onGrantCodes}
              onRevokeCodes={onRevokeCodes}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}

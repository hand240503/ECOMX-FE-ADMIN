/**
 * AdminStaffFormPage.tsx
 *
 * Trang tạo / chỉnh sửa nhân viên nội bộ (Internal Staff).
 * Dùng adminInternalStaffService — service riêng cho nhân viên nội bộ.
 * Khác AdminPersonnelFormPage (generic), page này:
 *   - Tự sinh mã SAP, hiển thị username + mật khẩu mặc định
 *   - Bắt buộc họ tên, email, SĐT
 *   - Modal credentials sau khi tạo thành công
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  RefreshCw,
  Upload,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  UserRound,
  ShieldCheck,
  KeyRound,
  BadgeCheck,
} from 'lucide-react';
import { adminRoleService } from '../../api/services/adminRoleService';
import {
  adminInternalStaffService,
  generateSapCode,
  deriveUsername,
  deriveDefaultPassword,
} from '../../api/services/adminInternalStaffService';
import { authService } from '../../api/services/authService';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { isCustomerRoleCode } from '../../lib/personnelSegment';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';
import type { RoleResponse } from '../../api/types/adminAccessControl.types';
import { adminUserManagementService } from '../../api/services/adminUserManagementService';
import { adminPermissionCatalogService } from '../../api/services/adminPermissionCatalogService';
import {
  buildPermissionMatrixRows,
  effectiveSetHasAnyEquivalent,
  flattenPermissionCatalog,
  isAssignablePermissionCodeViaUi,
} from '../../lib/permissionCatalog';
import { PermissionCrudMatrixEditor } from '../components/access/PermissionCrudMatrixEditor';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const CARD =
  'rounded-[20px] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]';
const INPUT = [
  'w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm',
  'text-[var(--text-primary)] placeholder-[var(--text-muted)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
].join(' ');
const LABEL =
  'flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]';

// ─── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Sao chép"
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
        copied
          ? 'bg-[var(--success)]/15 text-[var(--success)]'
          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-border)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Đã sao chép' : 'Sao chép'}
    </button>
  );
}

// ─── AvatarUpload ──────────────────────────────────────────────────────────────
interface AvatarUploadProps {
  preview: string | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}

function AvatarUpload({ preview, disabled, onChange }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      notify.error('Chỉ chấp nhận file ảnh.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      notify.error('Ảnh tối đa 5 MB.');
      return;
    }
    onChange(f);
  };

  return (
    <div className="flex items-start gap-5">
      {/* Preview circle */}
      <div className="relative flex-shrink-0">
        <div
          className={clsx(
            'h-24 w-24 rounded-2xl border-2 overflow-hidden flex items-center justify-center',
            preview
              ? 'border-[var(--accent)]'
              : 'border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]',
          )}
        >
          {preview ? (
            <img src={preview} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="size-10 text-[var(--text-muted)]" />
          )}
        </div>
        {preview && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={clsx(
          'flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors cursor-pointer',
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent)]/5'
            : 'border-[var(--bg-border)] bg-[var(--bg-elevated)]/40 hover:border-[var(--accent)]/50',
          disabled && 'pointer-events-none opacity-50',
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <Upload className="size-5 text-[var(--text-muted)]" />
        <p className="text-center text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--accent)]">Nhấn để chọn ảnh</span>
          {' '}hoặc kéo thả vào đây
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">PNG, JPG, WEBP · Tối đa 5 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ─── CredentialsModal ──────────────────────────────────────────────────────────
interface CredentialsModalProps {
  sapCode: string;
  username: string;
  defaultPassword: string;
  onClose: () => void;
}

function CredentialsModal({ sapCode, username, defaultPassword, onClose }: CredentialsModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const staticRows = [
    { icon: BadgeCheck, label: 'Mã SAP', value: sapCode, masked: false },
    { icon: UserRound, label: 'Username', value: username, masked: false },
  ];
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className={clsx(CARD, 'w-full max-w-md overflow-hidden p-0')}>
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tài khoản đã tạo thành công</h2>
              <p className="text-xs text-white/70">Lưu thông tin ngay — chỉ hiển thị một lần</p>
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-3 p-6">
          {staticRows.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="size-4 flex-shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {label}
                  </p>
                  <p className="truncate font-mono text-sm font-semibold tracking-wider text-[var(--text-primary)]">
                    {value}
                  </p>
                </div>
              </div>
              <CopyButton text={value} />
            </div>
          ))}
          {/* Password row — ẩn theo mặc định, reveal khi click */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <KeyRound className="size-4 flex-shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Mật khẩu mặc định
                </p>
                <p className="truncate font-mono text-sm font-semibold tracking-wider text-[var(--text-primary)]">
                  {showPassword ? defaultPassword : '••••••••••'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-border)] hover:text-[var(--text-primary)]"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <CopyButton text={defaultPassword} />
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--bg-border)] px-6 py-4">
          <p className="mb-3 text-[11px] text-[var(--text-muted)]">
            ⚠️ Mật khẩu mặc định chỉ để đăng nhập lần đầu. Yêu cầu nhân viên đổi ngay sau khi nhận tài khoản.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Đã lưu thông tin đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SapInfoCard ───────────────────────────────────────────────────────────────
interface SapInfoCardProps {
  sapCode: string;
  /** Username hiển thị — tuỳ chỉnh hoặc tự sinh */
  effectiveUsername?: string;
  onRegenerate: () => void;
  isCreate: boolean;
}

function SapInfoCard({ sapCode, effectiveUsername, onRegenerate, isCreate }: SapInfoCardProps) {
  const username = effectiveUsername ?? (sapCode !== '—' ? deriveUsername(sapCode) : '—');
  const password = sapCode !== '—' ? deriveDefaultPassword(sapCode) : '—';
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={clsx(CARD, 'space-y-4 p-6')}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Mã SAP & Đăng nhập</h2>
        {isCreate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-border)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw className="size-3.5" />
            Tạo mới
          </button>
        )}
      </div>

      {/* SAP code display */}
      <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Mã SAP
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-wider text-[var(--accent)]">
              {sapCode}
            </p>
          </div>
          {sapCode !== '—' && <CopyButton text={sapCode} />}
        </div>
      </div>

      {/* Derived credentials */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Username
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{username}</p>
        </div>
        <div className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Mật khẩu mặc định
          </p>
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
              {showPassword ? password : '••••••••••'}
            </p>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {isCreate && (
        <p className="text-[11px] text-[var(--text-muted)]">
          Username và mật khẩu tự sinh từ 6 chữ số cuối mã SAP. Nhấn "Tạo mới" để sinh lại mã SAP.
        </p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminStaffFormPage() {
  const { userId: userIdParam } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = authService.getCurrentUser();

  const isCreate = userIdParam == null;
  const userId = userIdParam != null ? Number(userIdParam) : NaN;
  const isValidEditId = Number.isFinite(userId) && userId > 0;

  const canCreate = adminAccessControlUi.createUser();
  const canUpdate = adminAccessControlUi.updateUser();
  const canList = adminAccessControlUi.listUsers();
  const canGrant = adminAccessControlUi.grantOrRevokePermission();
  const canLock = adminAccessControlUi.lockUser();
  const canDelete = adminAccessControlUi.deleteUser();

  // ── Create form ──────────────────────────────────────────────────────────
  const [sapCode, setSapCode] = useState(() => generateSapCode());
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  /** true nếu admin đã tự gõ username (không tự sync theo SAP nữa) */
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // ── Edit form ────────────────────────────────────────────────────────────
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState(1);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editSapCode, setEditSapCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── UI flags ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    sapCode: string;
    username: string;
    defaultPassword: string;
  } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => adminRoleService.list(signal),
    staleTime: 60_000,
    enabled: canList,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-internal-staff', userId],
    queryFn: ({ signal }) => adminInternalStaffService.getById(userId, signal),
    enabled: !isCreate && isValidEditId && canList,
  });

  const permsQuery = useQuery({
    queryKey: ['admin-user-permissions', userId],
    queryFn: ({ signal }) => adminUserManagementService.getUserPermissions(userId, signal),
    enabled: !isCreate && isValidEditId && canList,
  });

  const myPermsQuery = useQuery({
    queryKey: ['admin-user-permissions', me?.id],
    queryFn: ({ signal }) => adminUserManagementService.getUserPermissions(me!.id, signal),
    enabled: !isCreate && canGrant && me?.id != null,
  });

  const catalogQuery = useQuery({
    queryKey: ['admin-permissions-catalog'],
    queryFn: ({ signal }) => adminPermissionCatalogService.getCatalog(signal),
    staleTime: 120_000,
    enabled: canList,
  });

  // ── Hydrate edit form ────────────────────────────────────────────────────
  useEffect(() => {
    const u = detailQuery.data;
    if (!u) return;
    setEditFullName(u.userInfo?.fullName ?? '');
    setEditEmail(u.email ?? '');
    setEditPhone(u.phoneNumber ?? '');
    setEditStatus(u.status ?? 1);
    setEditSapCode(u.userInfo?.info01 ?? '');
    setEditAvatarPreview(u.userInfo?.avatar ?? null);
    const rid = u.roleIds?.[0];
    if (rid != null) {
      setEditRoleId(String(rid));
      return;
    }
    const code = u.roles?.[0];
    if (code) {
      const match = rolesQuery.data?.find((r) => r.code === code || r.code === `ROLE_${code}`);
      if (match) setEditRoleId(String(match.id));
    }
  }, [detailQuery.data, rolesQuery.data]);

  // ── Role choices (exclude customer & super roles) ─────────────────────────
  const roleChoices = useMemo((): RoleResponse[] => {
    const blocked = new Set(['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN']);
    return (rolesQuery.data ?? []).filter((r) => !isCustomerRoleCode(r.code) && !blocked.has(r.code));
  }, [rolesQuery.data]);

  // ── Permission matrix ─────────────────────────────────────────────────────
  const catalogEntries = useMemo(
    () =>
      flattenPermissionCatalog(catalogQuery.data ?? null).filter((e) =>
        isAssignablePermissionCodeViaUi(e.code),
      ),
    [catalogQuery.data],
  );
  const matrixRows = useMemo(() => buildPermissionMatrixRows(catalogEntries), [catalogEntries]);
  const effectiveSet = useMemo(
    () => new Set(permsQuery.data?.effectivePermissions ?? []),
    [permsQuery.data],
  );
  const rolePermSet = useMemo(
    () => new Set(permsQuery.data?.rolePermissions ?? []),
    [permsQuery.data],
  );
  const userPermSet = useMemo(
    () => new Set(permsQuery.data?.userPermissions ?? []),
    [permsQuery.data],
  );
  const assignableByPolicy = useCallback(
    (code: number) => {
      if (!isAssignablePermissionCodeViaUi(code)) return false;
      const broad = authService.hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN']);
      if (broad) return true;
      const eff = new Set(myPermsQuery.data?.effectivePermissions ?? []);
      return effectiveSetHasAnyEquivalent(eff, code);
    },
    [myPermsQuery.data],
  );

  // ── Avatar handlers ───────────────────────────────────────────────────────
  const handleAvatarChange = useCallback((file: File | null) => {
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }, []);

  const handleEditAvatarChange = useCallback(
    (file: File | null) => {
      setEditAvatarFile(file);
      setEditAvatarPreview(
        file ? URL.createObjectURL(file) : (detailQuery.data?.userInfo?.avatar ?? null),
      );
    },
    [detailQuery.data],
  );

  // ── Create ────────────────────────────────────────────────────────────────
  const onCreate = useCallback(async () => {
    if (!canCreate) { notify.error('Không có quyền tạo.'); return; }
    if (!fullName.trim()) { notify.error('Họ và tên là bắt buộc.'); return; }
    if (!email.trim()) { notify.error('Email là bắt buộc.'); return; }
    if (!phone.trim()) { notify.error('Số điện thoại là bắt buộc.'); return; }
    setSaving(true);
    try {
      const result = await adminInternalStaffService.create({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phone.trim(),
        sapCode,
        username: customUsername.trim() || undefined,
        avatarFile: avatarFile ?? undefined,
        status,
        roleId: roleId.trim() ? Number(roleId) : undefined,
      });
      // Username thực tế backend sử dụng (tuỳ chỉnh hoặc tự sinh)
      const resolvedUsername = customUsername.trim() || deriveUsername(sapCode);
      setSuccessModal({
        sapCode: result.sapCode,
        username: result.username ?? resolvedUsername,
        defaultPassword: result.defaultPassword,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-list'] });
      navigate(`/admin/staff/${result.id}/edit`, { replace: true });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Tạo thất bại'));
    } finally {
      setSaving(false);
    }
  }, [fullName, email, phone, sapCode, customUsername, avatarFile, status, roleId, canCreate, navigate, queryClient]);

  // ── Update ────────────────────────────────────────────────────────────────
  const onSaveEdit = useCallback(async () => {
    if (!isValidEditId || !canUpdate) { notify.error('Không có quyền cập nhật.'); return; }
    setSaving(true);
    try {
      await adminInternalStaffService.update({
        id: userId,
        fullName: editFullName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phoneNumber: editPhone.trim() || undefined,
        avatarFile: editAvatarFile ?? undefined,
        avatarUrl: !editAvatarFile ? (editAvatarPreview ?? undefined) : undefined,
        status: editStatus,
        roleId: editRoleId.trim() ? Number(editRoleId) : undefined,
        password: editPassword.trim() || undefined,
      });
      notify.success('Đã cập nhật');
      await queryClient.invalidateQueries({ queryKey: ['admin-internal-staff', userId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-list'] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  }, [
    userId, isValidEditId, editFullName, editEmail, editPhone,
    editAvatarFile, editAvatarPreview, editStatus, editRoleId, editPassword, canUpdate, queryClient,
  ]);

  // ── Toggle lock ───────────────────────────────────────────────────────────
  const onToggleLock = useCallback(async () => {
    if (!isValidEditId || !canLock) return;
    const next = editStatus === 1 ? 0 : 1;
    setSaving(true);
    try {
      await adminInternalStaffService.update({ id: userId, status: next });
      setEditStatus(next);
      notify.success(next === 1 ? 'Đã mở tài khoản' : 'Đã khóa tài khoản');
      await queryClient.invalidateQueries({ queryKey: ['admin-internal-staff', userId] });
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Thao tác thất bại'));
    } finally {
      setSaving(false);
    }
  }, [userId, editStatus, canLock, isValidEditId, queryClient]);

  // ── Reset password ────────────────────────────────────────────────────────
  const onResetPassword = useCallback(async () => {
    if (!isValidEditId || !canUpdate) return;
    setResetBusy(true);
    try {
      const res = await adminInternalStaffService.resetPassword(userId);
      if (res.temporaryPassword) {
        setSuccessModal({
          sapCode: editSapCode,
          username: detailQuery.data?.username ?? '',
          defaultPassword: res.temporaryPassword,
        });
      } else {
        notify.success('Đã đặt lại mật khẩu');
      }
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Đặt lại mật khẩu thất bại'));
    } finally {
      setResetBusy(false);
    }
  }, [userId, isValidEditId, canUpdate, editSapCode, detailQuery.data]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const onDelete = useCallback(async () => {
    if (!isValidEditId || !canDelete) return;
    if (!window.confirm(`Xóa nhân viên nội bộ #${userId}? Không thể hoàn tác.`)) return;
    setDeleteBusy(true);
    try {
      await adminInternalStaffService.delete(userId);
      notify.success('Đã xóa');
      await queryClient.invalidateQueries({ queryKey: ['admin-personnel-list'] });
      navigate('/admin/staff');
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Xóa thất bại'));
    } finally {
      setDeleteBusy(false);
    }
  }, [userId, isValidEditId, canDelete, navigate, queryClient]);

  // ── Permission handlers ───────────────────────────────────────────────────
  const onGrantCodes = useCallback(
    async (codes: number[]) => {
      if (!isValidEditId || !canGrant || codes.length === 0) return;
      setPermBusy(true);
      try {
        await adminUserManagementService.grantPermissions({
          userId,
          permissionCodes: codes,
          expiresAt: null,
        });
        notify.success('Đã cấp quyền');
        await queryClient.invalidateQueries({ queryKey: ['admin-user-permissions', userId] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Cấp quyền thất bại'));
      } finally {
        setPermBusy(false);
      }
    },
    [userId, canGrant, isValidEditId, queryClient],
  );

  const onRevokeCodes = useCallback(
    async (codes: number[]) => {
      if (!isValidEditId || !canGrant || codes.length === 0) return;
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
    [userId, canGrant, isValidEditId, queryClient],
  );

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!canList) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/staff"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Về danh sách
        </Link>
        <p className="text-sm text-[var(--text-secondary)]">Không có quyền xem / thao tác.</p>
      </div>
    );
  }
  if (isCreate && !canCreate) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/staff"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" />
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
          to="/admin/staff"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Về danh sách
        </Link>
        <p className="text-sm text-[var(--danger)]">ID không hợp lệ.</p>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const pageTitle = isCreate ? 'Tạo nhân viên nội bộ' : `Nhân viên nội bộ #${userId}`;
  const fieldDisabled = !isCreate && !canUpdate;
  const editLoaded = !isCreate && !detailQuery.isLoading && !detailQuery.isError && detailQuery.data != null;

  return (
    <div className="space-y-6">
      {/* ── Credentials Modal ── */}
      {successModal && (
        <CredentialsModal
          sapCode={successModal.sapCode}
          username={successModal.username}
          defaultPassword={successModal.defaultPassword}
          onClose={() => setSuccessModal(null)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/staff"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            <ArrowLeft className="size-4" />
            Danh sách nhân viên nội bộ
          </Link>
          <PricingPageHeader title={pageTitle} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Quản lý tài khoản nhân viên nội bộ với mã SAP định danh.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isCreate && editLoaded && (
            <>
              {editStatus === 1 ? (
                <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
              ) : (
                <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
              )}
              {canLock && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onToggleLock()}
                  className={clsx(
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
                    editStatus === 1
                      ? 'border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/15'
                      : 'bg-[var(--accent)] text-white hover:brightness-110',
                  )}
                >
                  {editStatus === 1 ? 'Khóa tài khoản' : 'Mở tài khoản'}
                </button>
              )}
              {canUpdate && (
                <button
                  type="button"
                  disabled={resetBusy || saving}
                  onClick={() => void onResetPassword()}
                  className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {resetBusy ? 'Đang xử lý…' : 'Đặt lại MK'}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  disabled={deleteBusy || saving}
                  onClick={() => void onDelete()}
                  className="rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/15 disabled:opacity-50"
                >
                  {deleteBusy ? 'Đang xóa…' : 'Xóa'}
                </button>
              )}
              {canUpdate && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onSaveEdit()}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu…' : 'Lưu thông tin'}
                </button>
              )}
            </>
          )}
          {isCreate && canCreate && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void onCreate()}
              className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Đang tạo…' : 'Tạo nhân viên'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout: 2 columns on large screens ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: form fields */}
        <div className="space-y-6">
          {/* Basic info */}
          <section className={clsx(CARD, 'p-6')}>
            <h2 className="mb-5 text-base font-semibold text-[var(--text-primary)]">Thông tin cơ bản</h2>

            {!isCreate && detailQuery.isLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Đang tải…</p>
            ) : !isCreate && detailQuery.isError ? (
              <p className="text-sm text-[var(--danger)]">
                {getApiErrorMessage(detailQuery.error, 'Không tải được dữ liệu')}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Họ tên */}
                <label className={clsx(LABEL, 'sm:col-span-2')}>
                  Họ và tên <span className="text-[var(--danger)] normal-case">*</span>
                  <input
                    className={INPUT}
                    placeholder="Nguyễn Văn A"
                    value={isCreate ? fullName : editFullName}
                    onChange={(e) =>
                      isCreate ? setFullName(e.target.value) : setEditFullName(e.target.value)
                    }
                    disabled={fieldDisabled}
                  />
                </label>

                {/* Email */}
                <label className={LABEL}>
                  Email <span className="text-[var(--danger)] normal-case">*</span>
                  <input
                    type="email"
                    className={INPUT}
                    placeholder="nhanvien@company.com"
                    value={isCreate ? email : editEmail}
                    onChange={(e) =>
                      isCreate ? setEmail(e.target.value) : setEditEmail(e.target.value)
                    }
                    disabled={fieldDisabled}
                  />
                </label>

                {/* SĐT */}
                <label className={LABEL}>
                  Số điện thoại <span className="text-[var(--danger)] normal-case">*</span>
                  <input
                    className={INPUT}
                    placeholder="0912345678"
                    value={isCreate ? phone : editPhone}
                    onChange={(e) =>
                      isCreate ? setPhone(e.target.value) : setEditPhone(e.target.value)
                    }
                    disabled={fieldDisabled}
                  />
                </label>

                {/* Username — editable on create, read-only on edit */}
                {isCreate ? (
                  <label className={clsx(LABEL, 'sm:col-span-2')}>
                    Username
                    <span className="normal-case font-normal text-[var(--text-muted)]">
                      {' '}(để trống để tự sinh từ mã SAP)
                    </span>
                    <input
                      className={INPUT}
                      placeholder={deriveUsername(sapCode)}
                      value={customUsername}
                      onChange={(e) => {
                        setCustomUsername(e.target.value);
                        setUsernameManuallyEdited(e.target.value !== '');
                      }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                ) : detailQuery.data ? (
                  <div className={clsx(LABEL, 'sm:col-span-2')}>
                    Username
                    <div className="flex items-center gap-2">
                      <div className={clsx(INPUT, 'cursor-default select-all opacity-80')}>
                        {detailQuery.data.username ?? '—'}
                      </div>
                      <CopyButton text={detailQuery.data.username ?? ''} />
                    </div>
                  </div>
                ) : null}

                {/* New password (edit only) */}
                {!isCreate && canUpdate && (
                  <label className={clsx(LABEL, 'sm:col-span-2')}>
                    Mật khẩu mới{' '}
                    <span className="normal-case font-normal text-[var(--text-muted)]">
                      (để trống để giữ nguyên)
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={clsx(INPUT, 'pr-10')}
                        placeholder="Nhập mật khẩu mới…"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </label>
                )}
              </div>
            )}
          </section>

          {/* Avatar */}
          <section className={clsx(CARD, 'p-6')}>
            <h2 className="mb-5 text-base font-semibold text-[var(--text-primary)]">Ảnh đại diện</h2>
            <AvatarUpload
              preview={isCreate ? avatarPreview : editAvatarPreview}
              disabled={fieldDisabled}
              onChange={isCreate ? handleAvatarChange : handleEditAvatarChange}
            />
          </section>

          {/* Permission matrix (edit only) */}
          {!isCreate && (
            <section className={clsx(CARD, 'p-6')}>
              <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">
                Bảng quyền hệ thống
              </h2>
              {catalogQuery.isLoading || permsQuery.isLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Đang tải…</p>
              ) : (
                <PermissionCrudMatrixEditor
                  rows={matrixRows}
                  effectiveSet={effectiveSet}
                  rolePermissionSet={rolePermSet}
                  userPermissionSet={userPermSet}
                  canMutate={canGrant}
                  isCodeAssignable={assignableByPolicy}
                  busy={permBusy}
                  onGrantCodes={onGrantCodes}
                  onRevokeCodes={onRevokeCodes}
                />
              )}
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* SAP info */}
          <SapInfoCard
            sapCode={isCreate ? sapCode : (editSapCode || '—')}
            effectiveUsername={
              isCreate
                ? (customUsername.trim() || deriveUsername(sapCode))
                : undefined
            }
            onRegenerate={() => {
              const next = generateSapCode();
              setSapCode(next);
              // Chỉ sync username nếu admin chưa tự gõ
              if (!usernameManuallyEdited) setCustomUsername(deriveUsername(next));
            }}
            isCreate={isCreate}
          />

          {/* Status & Role */}
          <section className={clsx(CARD, 'space-y-4 p-6')}>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Phân quyền & Trạng thái
            </h2>

            <label className={LABEL}>
              Trạng thái
              <select
                className={INPUT}
                value={isCreate ? String(status) : String(editStatus)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  isCreate ? setStatus(v) : setEditStatus(v);
                }}
                disabled={fieldDisabled}
              >
                <option value="1">{ADMIN_RECORD_STATUS_LABEL_VI.active}</option>
                <option value="0">{ADMIN_RECORD_STATUS_LABEL_VI.inactive}</option>
              </select>
            </label>

            <label className={LABEL}>
              Chức vụ / Quyền
              <select
                className={INPUT}
                value={isCreate ? roleId : editRoleId}
                onChange={(e) =>
                  isCreate ? setRoleId(e.target.value) : setEditRoleId(e.target.value)
                }
                disabled={fieldDisabled}
              >
                <option value="">{isCreate ? '— Chọn chức vụ —' : '— Giữ nguyên —'}</option>
                {roleChoices.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>

            {isCreate && (
              <p className="text-[11px] text-[var(--text-muted)]">
                Có thể gán chức vụ sau khi tạo tài khoản.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

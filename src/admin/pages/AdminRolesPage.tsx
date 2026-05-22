import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Search, Shield, Trash2 } from 'lucide-react';
import { adminRoleService } from '../../api/services/adminRoleService';
import { adminPermissionCatalogService } from '../../api/services/adminPermissionCatalogService';
import type { RoleResponse, UpsertRoleRequest } from '../../api/types/adminAccessControl.types';
import { flattenPermissionCatalog, isAssignablePermissionCodeViaUi, isSystemWildcardPermissionCode } from '../../lib/permissionCatalog';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';

type FormState = {
  code: string;
  name: string;
  description: string;
  status: number;
  permissionCodes: number[];
};

function emptyForm(): FormState {
  return { code: '', name: '', description: '', status: 1, permissionCodes: [] };
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const canCreate = adminAccessControlUi.createRole();
  const canUpdate = adminAccessControlUi.updateRole();
  const canDelete = adminAccessControlUi.deleteRole();
  const canList = adminAccessControlUi.listRoles();

  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [permFilter, setPermFilter] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Mã hệ thống (101–104, 110–112) từ backend được giữ khi sửa role, không chọn trong UI. */
  const [roleWildcardPreserve, setRoleWildcardPreserve] = useState<number[]>([]);

  const catalogQuery = useQuery({
    queryKey: ['admin-permissions-catalog'],
    queryFn: ({ signal }) => adminPermissionCatalogService.getCatalog(signal),
    staleTime: 120_000,
    enabled: canList && formOpen,
  });

  const catalogEntries = useMemo(
    () => flattenPermissionCatalog(catalogQuery.data ?? null),
    [catalogQuery.data]
  );

  const filteredCatalogForPick = useMemo(() => {
    const assignable = catalogEntries.filter((e) => isAssignablePermissionCodeViaUi(e.code));
    const q = permFilter.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter(
      (e) =>
        String(e.code).includes(q) ||
        e.label.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q) ?? false)
    );
  }, [catalogEntries, permFilter]);

  const listQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => adminRoleService.list(signal),
    staleTime: 60_000,
    enabled: canList,
  });

  const filtered = useMemo(() => {
    const all = listQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      if (String(r.id).includes(q)) return true;
      if (r.code.toLowerCase().includes(q)) return true;
      if (r.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [listQuery.data, filter]);

  useEffect(() => {
    const rows = listQuery.data;
    if (rows == null) return;
    if (rows.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    const valid = new Set(rows.map((r) => r.id));
    setSelectedIds((prev) => {
      let removed = false;
      const next = new Set<number>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else removed = true;
      });
      return removed ? next : prev;
    });
  }, [listQuery.data]);

  const toggleRowSelected = useCallback((id: number) => {
    if (!canDelete) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [canDelete]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (!canDelete || filtered.length === 0) return;
    const ids = filtered.map((r) => r.id);
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [canDelete, filtered]);

  const allFilteredSelected =
    canDelete && filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const openCreate = useCallback(() => {
    if (!canCreate) return;
    setEditingId(null);
    setRoleWildcardPreserve([]);
    setForm(emptyForm());
    setPermFilter('');
    setFormOpen(true);
  }, [canCreate]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setRoleWildcardPreserve([]);
  }, []);

  const startEdit = useCallback(
    (r: RoleResponse) => {
      if (!canUpdate) return;
      setEditingId(r.id);
      const pc = r.permissionCodes ?? [];
      setRoleWildcardPreserve(pc.filter(isSystemWildcardPermissionCode));
      setForm({
        code: r.code,
        name: r.name,
        description: r.description ?? '',
        status: r.status ?? 1,
        permissionCodes: pc.filter((c) => !isSystemWildcardPermissionCode(c)),
      });
      setPermFilter('');
      setFormOpen(true);
    },
    [canUpdate]
  );

  const togglePermissionCode = useCallback((code: number) => {
    setForm((prev) => {
      const next = new Set(prev.permissionCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, permissionCodes: [...next].sort((a, b) => a - b) };
    });
  }, []);

  const validate = useCallback((s: FormState): string | null => {
    const code = s.code.trim();
    const name = s.name.trim();
    if (!code) return 'Mã chức vụ (code) là bắt buộc.';
    if (!name) return 'Tên hiển thị là bắt buộc.';
    if (!Number.isFinite(s.status)) return 'Trạng thái không hợp lệ.';
    return null;
  }, []);

  const onSave = useCallback(async () => {
    const err = validate(form);
    if (err) {
      notify.error(err);
      return;
    }
    setSaving(true);
    try {
      const mergedCodes = [...new Set([...form.permissionCodes, ...roleWildcardPreserve])].sort((a, b) => a - b);
      const body: UpsertRoleRequest = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        permissionCodes: mergedCodes.length ? mergedCodes : undefined,
      };
      if (editingId == null) {
        if (!canCreate) return;
        await adminRoleService.create(body);
        notify.success('Đã tạo chức vụ');
      } else {
        if (!canUpdate) return;
        await adminRoleService.update(editingId, body);
        notify.success('Đã cập nhật chức vụ');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Tạo thất bại' : 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, roleWildcardPreserve, validate, queryClient, closeForm, canCreate, canUpdate]);

  const onConfirmDelete = useCallback(async (id: number) => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await adminRoleService.remove(id);
      notify.success('Đã xóa chức vụ');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setDeleteConfirmId(null);
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Xóa chức vụ thất bại'));
    } finally {
      setDeleting(false);
    }
  }, [canDelete, queryClient]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const headerCta =
    canCreate
      ? { label: 'Thêm chức vụ', onClick: () => (formOpen ? closeForm() : openCreate()), open: formOpen }
      : undefined;

  if (!canList) {
    return (
      <div className="space-y-4">
        <PricingPageHeader title="Chức vụ (Role)" />
        <p className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm text-[var(--text-secondary)]">
          Tài khoản không có quyền xem danh sách chức vụ (cần MANAGE_ROLE hoặc READ_ALL tương đương).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PricingPageHeader title="Chức vụ (Role)" cta={headerCta} />

      <AddFormShell
        presentation="modal"
        open={formOpen && (editingId == null ? canCreate : canUpdate)}
        title={editingId == null ? 'Tạo chức vụ' : `Sửa chức vụ #${editingId}`}
        onClose={closeForm}
        footer={
          <>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving ? 'Đang lưu…' : editingId == null ? 'Tạo' : 'Cập nhật'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Huỷ
            </button>
          </>
        }
      >
        <div className="grid max-h-[70vh] gap-3 overflow-hidden sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Mã (code)
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="VD: EMPLOYEE"
              className={inputCls}
              maxLength={64}
              autoComplete="off"
              disabled={editingId != null}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Tên hiển thị
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputCls}
              maxLength={255}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">
            Mô tả
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className={inputCls}
              maxLength={500}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Trạng thái
            <select
              value={String(form.status)}
              onChange={(e) => setForm((p) => ({ ...p, status: Number(e.target.value) }))}
              className={inputCls}
            >
              <option value="1">{ADMIN_RECORD_STATUS_LABEL_VI.active}</option>
              <option value="0">{ADMIN_RECORD_STATUS_LABEL_VI.inactive}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              Quyền mặc định gắn role (permissionCodes)
            </p>
            <p className="mb-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
              Không gán mã toàn hệ thống{' '}
              <span className="font-mono text-[var(--text-primary)]">101–104</span>,{' '}
              <span className="font-mono text-[var(--text-primary)]">110–112</span> qua UI — chỉ quản trị viên gán trực
              tiếp trên backend / seed.
              {roleWildcardPreserve.length > 0 ? (
                <span className="ms-1">
                  Role này đang có các mã đó từ backend (sẽ giữ khi lưu):{' '}
                  {roleWildcardPreserve.map((c) => (
                    <span
                      key={c}
                      className="ms-1 inline-block rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
                    >
                      {c}
                    </span>
                  ))}
                </span>
              ) : null}
            </p>
            <input
              value={permFilter}
              onChange={(e) => setPermFilter(e.target.value)}
              placeholder="Lọc theo mã hoặc nhãn…"
              className={clsx(inputCls, 'mb-2 w-full')}
            />
            <div className="max-h-48 overflow-auto rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] p-2 text-xs">
              {catalogQuery.isLoading ? (
                <p className="text-[var(--text-muted)]">Đang tải catalog…</p>
              ) : catalogQuery.isError ? (
                <p className="text-[var(--danger)]">{getApiErrorMessage(catalogQuery.error, 'Không tải catalog')}</p>
              ) : filteredCatalogForPick.length === 0 ? (
                <p className="text-[var(--text-muted)]">Không có mục khớp lọc.</p>
              ) : (
                <ul className="space-y-1">
                  {filteredCatalogForPick.map((e) => (
                    <li key={e.code}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-[var(--bg-elevated)]/60">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                          checked={form.permissionCodes.includes(e.code)}
                          onChange={() => togglePermissionCode(e.code)}
                        />
                        <span>
                          <span className="font-[family-name:var(--font-admin-mono)] font-semibold text-[var(--text-primary)]">
                            {e.code}
                          </span>
                          <span className="text-[var(--text-secondary)]"> — {e.label}</span>
                          {e.description ? (
                            <span className="block text-[10px] text-[var(--text-muted)]">{e.description}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Đã chọn {form.permissionCodes.length} mã (qua UI)
              {roleWildcardPreserve.length > 0
                ? ` · ${roleWildcardPreserve.length} mã wildcard giữ từ backend`
                : ''}{' '}
              · sau khi đổi quyền role, user đang đăng nhập có thể cần đăng nhập lại.
            </p>
          </div>
        </div>
      </AddFormShell>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm chức vụ</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm theo mã, tên hoặc ID…"
            className={clsx(inputCls, 'w-full pl-9')}
          />
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">{listQuery.data?.length ?? '…'} chức vụ</p>
      </div>

      {listQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
          Đang tải…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          {filter ? 'Không có chức vụ khớp bộ lọc.' : 'Chưa có chức vụ nào.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                  {canDelete ? (
                    <th className="w-11 px-3 py-3 align-middle">
                      <label className="flex cursor-pointer items-center justify-center">
                        <span className="sr-only">Chọn tất cả</span>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          className="size-4 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                        />
                      </label>
                    </th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Mã</th>
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if ((e.target as HTMLElement).closest('[data-role-action-cell]')) return;
                      if (!canUpdate) return;
                      startEdit(r);
                    }}
                    title={canUpdate ? 'Double-click để sửa' : undefined}
                    className={clsx(
                      'border-b border-[var(--bg-border)]/80 hover:bg-[var(--bg-elevated)]/40',
                      canUpdate ? 'cursor-pointer select-none' : ''
                    )}
                  >
                    {canDelete ? (
                      <td
                        data-role-action-cell
                        className="w-11 px-3 py-3 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleRowSelected(r.id)}
                            className="size-4 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                          />
                        </label>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-muted)]">
                      {r.id}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs font-medium text-[var(--text-primary)]">
                      {r.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                          <Shield className="size-3.5" aria-hidden />
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(r.status ?? 1) === 1 ? (
                        <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
                      ) : (
                        <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
                      )}
                    </td>
                    <td data-role-action-cell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="text-xs font-semibold text-[var(--accent)] hover:underline"
                          >
                            Sửa
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(r.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--danger)] hover:underline"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Xóa
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteConfirmId != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Xóa chức vụ?</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Xóa không hoàn tác. Các user đang gắn role này có thể bị ảnh hưởng.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => !deleting && setDeleteConfirmId(null)}
                className="rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void onConfirmDelete(deleteConfirmId)}
                className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {deleting ? 'Đang xóa…' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

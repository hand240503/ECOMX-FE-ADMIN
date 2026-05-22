import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { clsx } from 'clsx';
import { Pencil, Ruler, Search, Trash2 } from 'lucide-react';
import { adminUnitService } from '../../api/services/adminUnitService';
import type { CreateUnitRequest, UnitResponse, UpdateUnitRequest } from '../../api/types/unit.types';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';

type FormState = {
  name_unit: string;
  ratio: number;
  status: number;
};

function emptyForm(): FormState {
  return { name_unit: '', ratio: 1, status: 1 };
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

export default function AdminUnitsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnitResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-units'],
    queryFn: ({ signal }) => adminUnitService.list(signal),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const all = listQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((u) => {
      if (String(u.id).includes(q)) return true;
      if (u.name_unit.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [listQuery.data, filter]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((u: UnitResponse) => {
    setEditingId(u.id);
    setForm({ name_unit: u.name_unit, ratio: u.ratio, status: u.status });
    setFormOpen(true);
  }, []);

  const validate = useCallback((s: FormState): string | null => {
    const name = s.name_unit.trim();
    if (!name) return 'Tên đơn vị là bắt buộc.';
    if (!Number.isFinite(s.ratio) || s.ratio < 1) return 'Hệ số quy đổi phải ≥ 1.';
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
      const trimmed = form.name_unit.trim();
      if (editingId == null) {
        const body: CreateUnitRequest = { name_unit: trimmed, ratio: form.ratio, status: form.status };
        await adminUnitService.create(body);
        notify.success('Đã tạo đơn vị');
      } else {
        const body: UpdateUnitRequest = { name_unit: trimmed, ratio: form.ratio, status: form.status };
        await adminUnitService.update(editingId, body);
        notify.success('Đã cập nhật đơn vị');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Tạo thất bại' : 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, validate, queryClient, closeForm]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminUnitService.remove(deleteTarget.id);
      notify.success('Đã xóa đơn vị');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-units'] });
    } catch (e) {
      const unitLabel = `“${deleteTarget.name_unit}” (#${deleteTarget.id})`;
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        const detail = getApiErrorMessage(e, '').trim();
        const hint =
          'Hãy mở Giá niêm yết (catalog), chỉnh hoặc xóa các dòng giá đang dùng đơn vị này, rồi thử xóa đơn vị lại.';
        const body =
          detail !== ''
            ? `Không thể xóa đơn vị ${unitLabel}.\n\nChi tiết: ${detail}\n\n${hint}`
            : `Không thể xóa đơn vị ${unitLabel} vì đơn vị này vẫn đang được gán trong giá catalog của một hoặc nhiều sản phẩm.\n\n${hint}`;
        setDeleteErrorAlert({ title: 'Không thể xóa đơn vị', message: body });
      } else {
        setDeleteErrorAlert({
          title: 'Không xóa được đơn vị',
          message: getApiErrorMessage(e, 'Đã có lỗi xảy ra khi xóa. Vui lòng thử lại sau.'),
        });
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, queryClient]);

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Đơn vị tính (Unit)"
        cta={{ label: 'Tạo đơn vị', onClick: () => (formOpen ? closeForm() : openCreate()), open: formOpen }}
      />

      <AddFormShell
        open={formOpen}
        title={editingId == null ? 'Tạo đơn vị mới' : `Sửa đơn vị #${editingId}`}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">
            Tên đơn vị
            <input
              value={form.name_unit}
              onChange={(e) => setForm((p) => ({ ...p, name_unit: e.target.value }))}
              placeholder="Cái, Hộp, Thùng…"
              className={inputCls}
              maxLength={64}
            />
            <span className="text-[10px] text-[var(--text-muted)]">
              Không phân biệt hoa thường; tên trùng đơn vị khác sẽ bị từ chối.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Hệ số quy đổi (ratio)
            <input
              type="number"
              min={1}
              value={form.ratio}
              onChange={(e) => setForm((p) => ({ ...p, ratio: Number(e.target.value) }))}
              className={inputCls}
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
        </div>
      </AddFormShell>

      {/* Toolbar — search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm đơn vị</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm theo tên hoặc ID…"
            className={clsx(inputCls, 'w-full pl-9')}
          />
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">{listQuery.data?.length ?? '…'} đơn vị</p>
      </div>

      {/* List */}
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
          {filter
            ? 'Không có đơn vị khớp bộ lọc.'
            : 'Chưa có đơn vị nào. Bấm “Tạo đơn vị” để thêm đơn vị đầu tiên.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-4 py-3 font-semibold">Hệ số (ratio)</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                  <th className="sticky right-0 px-4 py-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--bg-border)]/80 hover:bg-[var(--bg-elevated)]/40">
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-muted)]">
                      {u.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                          <Ruler className="size-3.5" aria-hidden />
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">{u.name_unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-[var(--text-primary)]">
                      ×{u.ratio}
                    </td>
                    <td className="px-4 py-3">
                      {u.status === 1 ? (
                        <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
                      ) : (
                        <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {formatTimestamp(u.modifiedDate ?? u.createdDate)}
                    </td>
                    <td className="sticky right-0 bg-[var(--bg-surface)] px-4 py-3 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="rounded-md p-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          aria-label={`Sửa ${u.name_unit}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-elevated)]"
                          aria-label={`Xóa ${u.name_unit}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Xóa đơn vị?"
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa đơn vị “${deleteTarget.name_unit}” (#${deleteTarget.id})? Thao tác này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        confirmVariant="danger"
        confirmLoading={deleting}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <AlertDialog
        open={deleteErrorAlert != null}
        title={deleteErrorAlert?.title ?? ''}
        message={deleteErrorAlert?.message ?? ''}
        variant="error"
        actionLabel="Đã hiểu"
        onClose={() => setDeleteErrorAlert(null)}
      />
    </div>
  );
}

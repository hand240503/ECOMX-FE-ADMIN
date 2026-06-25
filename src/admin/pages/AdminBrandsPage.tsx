import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Award, ImagePlus, Loader2, Search, Trash2, X } from 'lucide-react';
import { adminBrandService } from '../../api/services/adminBrandService';
import { adminDocumentService } from '../../api/services/adminDocumentService';
import { DOCUMENT_ENTITY_TYPE_BRAND } from '../constants/documentEntities';
import type { BrandResponse, CreateBrandRequest, UpdateBrandRequest } from '../../api/types/brand.types';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { adminBrandPermissions } from '../../lib/adminBrandPermissions';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';

type FormState = {
  code: string;
  name: string;
  status: number;
};

function emptyForm(): FormState {
  return { code: '', name: '', status: 1 };
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

/** Logo hiển thị trong bảng: ảnh nếu có, fallback icon Award */
function BrandLogo({ logoUrl, name, size = 'md' }: { logoUrl?: string | null; name: string; size?: 'sm' | 'md' }) {
  if (logoUrl) {
    const cls =
      size === 'sm'
        ? 'h-[22px] w-auto max-w-[56px] object-contain rounded'
        : 'h-[28px] w-auto max-w-[72px] object-contain rounded';
    return <img src={logoUrl} alt={name} className={cls} loading="lazy" />;
  }
  const dim = size === 'sm' ? 'size-6' : 'size-7';
  return (
    <span
      className={clsx(
        dim,
        'flex shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]'
      )}
    >
      <Award className="size-3.5" aria-hidden />
    </span>
  );
}

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const canCreate = adminBrandPermissions.canCreate();
  const canUpdate = adminBrandPermissions.canUpdate();
  const canDelete = adminBrandPermissions.canDelete();

  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkErrorAlert, setBulkErrorAlert] = useState<{ title: string; message: string } | null>(null);

  // ── Logo upload states ──────────────────────────────────────────────────────
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listQuery = useQuery({
    queryKey: ['admin-brands'],
    queryFn: ({ signal }) => adminBrandService.list(signal),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const all = listQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((b) => {
      if (String(b.id).includes(q)) return true;
      if (b.code.toLowerCase().includes(q)) return true;
      if (b.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [listQuery.data, filter]);

  useEffect(() => {
    const rows = listQuery.data;
    if (rows == null) return;
    if (rows.length === 0) { setSelectedIds(new Set()); return; }
    const valid = new Set(rows.map((b) => b.id));
    setSelectedIds((prev) => {
      let removed = false;
      const next = new Set<number>();
      prev.forEach((id) => { if (valid.has(id)) next.add(id); else removed = true; });
      return removed ? next : prev;
    });
  }, [listQuery.data]);

  // Giải phóng object URL khi unmount hoặc preview đổi
  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const selectedCount = selectedIds.size;

  const toggleRowSelected = useCallback((id: number) => {
    if (!canDelete) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [canDelete]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (!canDelete || filtered.length === 0) return;
    const ids = filtered.map((b) => b.id);
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [canDelete, filtered]);

  const allFilteredSelected =
    canDelete && filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));

  // ── Logo handlers ───────────────────────────────────────────────────────────
  const resetLogo = useCallback(() => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [logoPreview]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        notify.error('Chỉ chấp nhận file ảnh (jpg, png, webp, svg…)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.error('Ảnh phải nhỏ hơn 5 MB');
        return;
      }
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    },
    [logoPreview]
  );

  // ── Form open/close ─────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    if (!canCreate) return;
    setEditingId(null);
    setForm(emptyForm());
    resetLogo();
    setExistingLogo(null);
    setFormOpen(true);
  }, [canCreate, resetLogo]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    resetLogo();
    setExistingLogo(null);
  }, [resetLogo]);

  const startEdit = useCallback(
    (b: BrandResponse) => {
      if (!canUpdate) return;
      setEditingId(b.id);
      setForm({ code: b.code, name: b.name, status: b.status });
      resetLogo();
      setExistingLogo(b.logoUrl ?? null);
      setFormOpen(true);
    },
    [canUpdate, resetLogo]
  );

  // ── Save ────────────────────────────────────────────────────────────────────
  const validate = useCallback((s: FormState): string | null => {
    if (!s.code.trim()) return 'Mã hãng là bắt buộc.';
    if (!s.name.trim()) return 'Tên hãng là bắt buộc.';
    if (!Number.isFinite(s.status)) return 'Trạng thái không hợp lệ.';
    return null;
  }, []);

  const onSave = useCallback(async () => {
    const err = validate(form);
    if (err) { notify.error(err); return; }
    setSaving(true);
    try {
      const codeTrim = form.code.trim();
      const nameTrim = form.name.trim();
      let savedId: number;

      if (editingId == null) {
        if (!canCreate) return;
        const body: CreateBrandRequest = { code: codeTrim, name: nameTrim, status: form.status };
        const created = await adminBrandService.create(body);
        savedId = created.id;
        notify.success('Đã tạo hãng');
      } else {
        if (!canUpdate) return;
        const body: UpdateBrandRequest = { code: codeTrim, name: nameTrim, status: form.status };
        await adminBrandService.update(editingId, body);
        savedId = editingId;
        notify.success('Đã cập nhật hãng');
      }

      // Upload logo nếu có chọn file mới
      if (logoFile) {
        try {
          await adminDocumentService.upload([logoFile], {
            entityId: savedId,
            entityType: DOCUMENT_ENTITY_TYPE_BRAND,
            mainFileIndex: 0,
          });
        } catch (uploadErr) {
          notify.error('Lưu hãng thành công nhưng upload logo thất bại: ' + getApiErrorMessage(uploadErr, ''));
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Tạo thất bại' : 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, logoFile, validate, queryClient, closeForm, canCreate, canUpdate]);

  // ── Bulk delete ─────────────────────────────────────────────────────────────
  const onConfirmBulkDelete = useCallback(async () => {
    if (!canDelete || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setBulkDeleting(true);
    try {
      // Xóa hàng loạt 1 lượt: sản phẩm thuộc các hãng này được gỡ hãng (set null).
      const res = await adminBrandService.bulkRemove(ids);
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      notify.success(`Đã xóa ${res.deleted} thương hiệu (gỡ ${res.productsDetached} sản phẩm)`);
    } catch (e) {
      setBulkErrorAlert({
        title: 'Xóa hàng loạt thất bại',
        message: getApiErrorMessage(e, 'Không xóa được thương hiệu đã chọn.'),
      });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  }, [canDelete, selectedIds, queryClient]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const headerCta = canCreate
    ? { label: 'Thêm hãng', onClick: () => (formOpen ? closeForm() : openCreate()), open: formOpen }
    : undefined;

  // Ảnh hiển thị trong form: file mới → preview, không có → ảnh cũ từ server
  const displayLogo = logoPreview ?? existingLogo;

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Hãng / Thương hiệu (Brand)"
        cta={headerCta}
      />

      {/* ── Form modal ──────────────────────────────────────────────────────── */}
      <AddFormShell
        presentation="modal"
        open={formOpen && (editingId == null ? canCreate : canUpdate)}
        title={editingId == null ? 'Tạo hãng mới' : `Sửa hãng #${editingId}`}
        onClose={closeForm}
        footer={
          <>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white',
                'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {saving ? 'Đang lưu…' : editingId == null ? 'Tạo' : 'Lưu thay đổi'}
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
          {/* Code */}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Mã hãng (code) <span className="font-normal text-[var(--danger)]">*</span>
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="VD: SONY, LG…"
              className={inputCls}
              maxLength={64}
              autoComplete="off"
            />
          </label>

          {/* Name */}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Tên hiển thị <span className="font-normal text-[var(--danger)]">*</span>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="VD: Sony, LG Electronics…"
              className={inputCls}
              maxLength={255}
            />
          </label>

          {/* Status */}
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

          {/* Logo upload — chiếm cả 2 cột */}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              Logo hãng
              <span className="ml-1 font-normal text-[var(--text-muted)]">(png, jpg, svg · tối đa 5 MB)</span>
            </p>

            <div className="flex items-start gap-4">
              {/* Preview box — tỷ lệ 3:1 */}
              <div
                className={clsx(
                  'relative flex h-[56px] w-[168px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                  displayLogo
                    ? 'border-[var(--bg-border)] bg-white'
                    : 'border-[var(--bg-border)] bg-[var(--bg-elevated)]'
                )}
              >
                {displayLogo ? (
                  <>
                    <img
                      src={displayLogo}
                      alt="Logo hãng"
                      className="max-h-[40px] max-w-[148px] object-contain"
                    />
                    {/* Nút xoá chọn file mới */}
                    {logoFile && (
                      <button
                        type="button"
                        onClick={resetLogo}
                        aria-label="Bỏ chọn ảnh"
                        className={clsx(
                          'absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full',
                          'bg-[var(--bg-surface)] border border-[var(--bg-border)] text-[var(--text-secondary)]',
                          'hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors shadow-sm'
                        )}
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    <Award className="size-8 opacity-30" aria-hidden />
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    'border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]',
                    'hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  )}
                >
                  <ImagePlus className="size-3.5" aria-hidden />
                  {displayLogo ? 'Đổi logo' : 'Chọn ảnh'}
                </button>

                {displayLogo && !logoFile && existingLogo && (
                  <p className="text-[10px] text-[var(--text-muted)] leading-snug max-w-[160px]">
                    Logo hiện tại. Bấm "Đổi logo" để thay thế.
                  </p>
                )}
                {logoFile && (
                  <p className="text-[10px] text-[var(--accent)] leading-snug max-w-[160px]">
                    ✓ Sẽ upload khi lưu
                  </p>
                )}
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>
      </AddFormShell>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm hãng</span>
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
        <p className="text-[11px] text-[var(--text-muted)]">
          {listQuery.data?.length ?? '…'} hãng
          {canUpdate ? ' · Double-click một dòng để mở sửa.' : ''}
        </p>
      </div>

      {!canCreate && !canUpdate && !canDelete ? (
        <p className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          Tài khoản của bạn có thể chỉ xem danh sách. Cần quyền tạo, sửa hoặc xóa hãng để thao tác đầy đủ.
        </p>
      ) : null}

      {/* ── Bulk delete bar ──────────────────────────────────────────────────── */}
      {canDelete && (listQuery.data?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--card-shadow)]">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Đã chọn{' '}
            <span className="font-[family-name:var(--font-admin-mono)] font-semibold text-[var(--text-primary)]">
              {selectedCount}
            </span>{' '}
            hãng · tick ô bên trái bảng hoặc "chọn tất cả" trên dòng lọc hiện tại.
          </p>
          <button
            type="button"
            disabled={selectedCount === 0 || bulkDeleting}
            onClick={() => selectedCount > 0 && setBulkDeleteOpen(true)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold',
              selectedCount === 0 || bulkDeleting
                ? 'cursor-not-allowed border border-[var(--bg-border)] text-[var(--text-muted)] opacity-60'
                : 'border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/15'
            )}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
            {bulkDeleting ? 'Đang xóa…' : `Xóa đã chọn (${selectedCount})`}
          </button>
        </div>
      ) : null}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
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
            ? 'Không có hãng khớp bộ lọc.'
            : canCreate
              ? 'Chưa có hãng nào. Bấm "Thêm hãng" để tạo hãng đầu tiên.'
              : 'Chưa có hãng nào trong hệ thống.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 text-[var(--text-secondary)]">
                  <th className="w-11 px-3 py-3 align-middle">
                    {canDelete ? (
                      <label className="flex cursor-pointer items-center justify-center">
                        <span className="sr-only">Chọn tất cả hãng đang hiển thị</span>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          className="size-4 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                        />
                      </label>
                    ) : (
                      <span className="sr-only">Chọn</span>
                    )}
                  </th>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Logo</th>
                  <th className="px-4 py-3 font-semibold">Mã</th>
                  <th className="px-4 py-3 font-semibold">Tên hãng</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if ((e.target as HTMLElement).closest('[data-brand-checkbox-cell]')) return;
                      if (!canUpdate) return;
                      startEdit(b);
                    }}
                    title={canUpdate ? 'Double-click để sửa hãng' : undefined}
                    className={clsx(
                      'border-b border-[var(--bg-border)]/80 hover:bg-[var(--bg-elevated)]/40',
                      canUpdate ? 'cursor-pointer select-none' : ''
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      data-brand-checkbox-cell
                      className="w-11 px-3 py-3 align-middle"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      {canDelete ? (
                        <label className="flex cursor-pointer items-center justify-center">
                          <span className="sr-only">Chọn hãng {b.name}</span>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(b.id)}
                            onChange={() => toggleRowSelected(b.id)}
                            className="size-4 rounded border-[var(--bg-border)] accent-[var(--accent)]"
                          />
                        </label>
                      ) : (
                        <span className="block w-4" aria-hidden />
                      )}
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-muted)]">
                      {b.id}
                    </td>

                    {/* Logo */}
                    <td className="px-4 py-3">
                      <div className="flex h-[36px] w-[80px] items-center justify-center rounded-md border border-[var(--bg-border)] bg-white px-1">
                        <BrandLogo logoUrl={b.logoUrl} name={b.name} size="md" />
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs font-medium text-[var(--text-primary)]">
                      {b.code}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {b.name}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {b.status === 1 ? (
                        <StatusBadge tone="success" label="Active" />
                      ) : (
                        <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
                      )}
                    </td>

                    {/* Updated at */}
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {formatTimestamp(b.modifiedDate ?? b.createdDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={bulkDeleteOpen && canDelete && selectedCount > 0}
        title="Xóa các hãng đã chọn?"
        message={`Bạn sắp xóa ${selectedCount} hãng đã tick. Sản phẩm thuộc các hãng này sẽ được gỡ hãng (để trống), không bị xóa. Thao tác không hoàn tác. Tiếp tục?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        confirmVariant="danger"
        confirmLoading={bulkDeleting}
        onConfirm={() => void onConfirmBulkDelete()}
        onCancel={() => !bulkDeleting && setBulkDeleteOpen(false)}
      />

      <AlertDialog
        open={bulkErrorAlert != null}
        title={bulkErrorAlert?.title ?? ''}
        message={bulkErrorAlert?.message ?? ''}
        variant="error"
        actionLabel="Đã hiểu"
        onClose={() => setBulkErrorAlert(null)}
      />
    </div>
  );
}

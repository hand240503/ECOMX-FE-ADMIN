import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronRight, FolderTree, ImagePlus, Loader2, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import { adminCategoryService } from '../../api/services/adminCategoryService';
import { adminDocumentService } from '../../api/services/adminDocumentService';
import { DOCUMENT_ENTITY_TYPE_CATEGORY } from '../constants/documentEntities';
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from '../../api/types/category.types';
import { adminCategoryPermissions } from '../../lib/adminCategoryPermissions';
import { getApiErrorMessage } from '../../utils/apiError';
import { notify } from '../../utils/notify';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';
import { ExportExcelButton } from '../components/ExportExcelButton';
import { AdminCatalogImportModal } from '../components/AdminCatalogImportModal';
import { AddFormShell } from '../components/pricing/AddFormShell';
import { ADMIN_RECORD_STATUS_LABEL_VI, StatusBadge } from '../components/pricing/StatusBadge';

type FormState = {
  code: string;
  name: string;
  status: number;
  parentIdStr: string;
};

function emptyForm(): FormState {
  return { code: '', name: '', status: 1, parentIdStr: '' };
}

function collectDescendantIds(flat: CategoryResponse[], rootId: number): Set<number> {
  const byParent = new Map<number | null, number[]>();
  for (const c of flat) {
    const p = c.parentId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(c.id);
  }
  const out = new Set<number>();
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.add(id);
    for (const child of byParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

/**
 * Hiển thị banner 240×50 (thu nhỏ) hoặc fallback icon FolderTree.
 * Trong list dùng size="sm" → giới hạn chiều rộng để vừa hàng.
 */
function CategoryAvatar({
  thumbnailUrl,
  name,
  size = 'md',
}: {
  thumbnailUrl?: string | null;
  name: string;
  size?: 'sm' | 'md';
}) {
  if (thumbnailUrl) {
    // Duy trì tỷ lệ 240:50 = 4.8:1; sm → w-[72px] h-[15px], md → w-[96px] h-[20px]
    const cls = size === 'sm'
      ? 'w-[72px] h-[15px] rounded object-cover shrink-0'
      : 'w-[96px] h-[20px] rounded-md object-cover shrink-0';
    return <img src={thumbnailUrl} alt={name} className={cls} loading="lazy" />;
  }
  const dim = size === 'sm' ? 'size-6' : 'size-7';
  return (
    <span
      className={clsx(
        dim,
        'flex shrink-0 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
      )}
    >
      <FolderTree className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
    </span>
  );
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const canCreate = adminCategoryPermissions.canCreate();
  const canUpdate = adminCategoryPermissions.canUpdate();
  const canDelete = adminCategoryPermissions.canDelete();

  const [filter, setFilter] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Ảnh đại diện trong form
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: ({ signal }) => adminCategoryService.list(signal),
    staleTime: 60_000,
  });

  const flatList = listQuery.data ?? [];

  const parentPickerExcludeIds = useMemo(() => {
    if (editingId == null) return new Set<number>();
    const desc = collectDescendantIds(flatList, editingId);
    desc.add(editingId);
    return desc;
  }, [flatList, editingId]);

  const parentOptions = useMemo(() => {
    return [...flatList]
      .filter((c) => !parentPickerExcludeIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [flatList, parentPickerExcludeIds]);

  const rootCategories = useMemo(() => {
    return [...flatList]
      .filter((c) => c.parentId == null)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [flatList]);

  const matchesFilter = useCallback(
    (c: CategoryResponse, q: string) => {
      if (!q) return true;
      if (String(c.id).includes(q)) return true;
      if (c.code.toLowerCase().includes(q)) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      return false;
    },
    []
  );

  const filteredRoots = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rootCategories.filter((c) => matchesFilter(c, q));
  }, [rootCategories, filter, matchesFilter]);

  const selectedParent = useMemo(() => {
    if (selectedParentId == null) return null;
    return flatList.find((c) => c.id === selectedParentId) ?? null;
  }, [flatList, selectedParentId]);

  const childCategories = useMemo(() => {
    if (selectedParentId == null) return [];
    return [...flatList]
      .filter((c) => c.parentId === selectedParentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [flatList, selectedParentId]);

  const filteredChildren = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return childCategories.filter((c) => matchesFilter(c, q));
  }, [childCategories, filter, matchesFilter]);

  useEffect(() => {
    if (rootCategories.length === 0) {
      setSelectedParentId(null);
      return;
    }
    setSelectedParentId((prev) => {
      if (prev != null && rootCategories.some((r) => r.id === prev)) return prev;
      return rootCategories[0].id;
    });
  }, [rootCategories]);

  useEffect(() => {
    if (filteredRoots.length === 0) {
      if (filter.trim() !== '' && rootCategories.length > 0) {
        setSelectedParentId(null);
      }
      return;
    }
    setSelectedParentId((prev) => {
      if (prev != null && filteredRoots.some((r) => r.id === prev)) return prev;
      return filteredRoots[0].id;
    });
  }, [filter, filteredRoots, rootCategories.length]);

  // Giải phóng object URL khi unmount hoặc preview đổi
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  const resetThumbnail = useCallback(() => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [thumbnailPreview]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        notify.error('Chỉ chấp nhận file ảnh (jpg, png, webp…)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.error('Ảnh phải nhỏ hơn 5 MB');
        return;
      }
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    },
    [thumbnailPreview]
  );

  const openCreate = useCallback(
    (defaultParentId?: number | null) => {
      if (!canCreate) return;
      setEditingId(null);
      setForm({
        ...emptyForm(),
        parentIdStr: defaultParentId != null ? String(defaultParentId) : '',
      });
      resetThumbnail();
      setExistingThumbnail(null);
      setFormOpen(true);
    },
    [canCreate, resetThumbnail]
  );

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    resetThumbnail();
    setExistingThumbnail(null);
  }, [resetThumbnail]);

  const startEdit = useCallback(
    (c: CategoryResponse) => {
      if (!canUpdate) return;
      setEditingId(c.id);
      setForm({
        code: c.code,
        name: c.name,
        status: c.status,
        parentIdStr: c.parentId != null ? String(c.parentId) : '',
      });
      resetThumbnail();
      setExistingThumbnail(c.thumbnailUrl ?? null);
      setFormOpen(true);
    },
    [canUpdate, resetThumbnail]
  );

  const validate = useCallback((s: FormState): string | null => {
    if (!s.code.trim()) return 'Mã danh mục là bắt buộc.';
    if (!s.name.trim()) return 'Tên danh mục là bắt buộc.';
    if (!Number.isFinite(s.status)) return 'Trạng thái không hợp lệ.';
    if (s.parentIdStr.trim() !== '') {
      const pid = Number(s.parentIdStr);
      if (!Number.isFinite(pid) || pid <= 0) return 'Danh mục cha không hợp lệ.';
    }
    return null;
  }, []);

  const onSave = useCallback(async () => {
    const err = validate(form);
    if (err) { notify.error(err); return; }
    setSaving(true);
    try {
      const codeTrim = form.code.trim();
      const nameTrim = form.name.trim();
      const parentParsed = form.parentIdStr.trim() === '' ? null : Number(form.parentIdStr) as number;

      let savedId: number;

      if (editingId == null) {
        if (!canCreate) return;
        const body: CreateCategoryRequest = {
          code: codeTrim,
          name: nameTrim,
          status: form.status,
          ...(parentParsed != null ? { parentId: parentParsed } : {}),
        };
        const created = await adminCategoryService.create(body);
        savedId = created.id;
        notify.success('Đã tạo danh mục');
      } else {
        if (!canUpdate) return;
        const body: UpdateCategoryRequest = {
          code: codeTrim,
          name: nameTrim,
          status: form.status,
          parentId: parentParsed,
        };
        await adminCategoryService.update(editingId, body);
        savedId = editingId;
        notify.success('Đã cập nhật danh mục');
      }

      // Upload ảnh đại diện nếu có chọn file mới
      if (thumbnailFile) {
        try {
          await adminDocumentService.upload([thumbnailFile], {
            entityId: savedId,
            entityType: DOCUMENT_ENTITY_TYPE_CATEGORY,
            mainFileIndex: 0,
          });
        } catch (uploadErr) {
          notify.error('Lưu danh mục thành công nhưng upload ảnh thất bại: ' + getApiErrorMessage(uploadErr, ''));
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      closeForm();
    } catch (e) {
      notify.error(getApiErrorMessage(e, editingId == null ? 'Tạo thất bại' : 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, thumbnailFile, validate, queryClient, closeForm, canCreate, canUpdate]);

  const handleDelete = useCallback(
    async (c: CategoryResponse) => {
      if (!canDelete) return;
      const childCount = c.childrenCount ?? 0;
      if (childCount > 0) {
        notify.error(`Không thể xóa "${c.name}": còn ${childCount} danh mục con. Hãy xóa/di chuyển danh mục con trước.`);
        return;
      }
      if (!window.confirm(`Xóa danh mục "${c.name}" (#${c.id})? Hành động này không thể hoàn tác.`)) return;
      try {
        await adminCategoryService.remove(c.id);
        notify.success('Đã xóa danh mục');
        if (selectedParentId === c.id) setSelectedParentId(null);
        await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      } catch (e) {
        notify.error(getApiErrorMessage(e, 'Xóa danh mục thất bại (có thể còn sản phẩm hoặc danh mục con).'));
      }
    },
    [canDelete, selectedParentId, queryClient]
  );

  const inputCls =
    'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const headerCta = canCreate
    ? {
        label: 'Thêm danh mục',
        onClick: () => (formOpen ? closeForm() : openCreate(selectedParentId ?? undefined)),
        open: formOpen,
      }
    : undefined;

  // Ảnh hiển thị trong form: file mới chọn → preview, không có → ảnh cũ
  const displayThumbnail = thumbnailPreview ?? existingThumbnail;

  return (
    <div className="space-y-5">
      <PricingPageHeader
        title="Danh mục"
        cta={headerCta}
        extra={
          <>
            {canCreate && (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Upload className="size-4" aria-hidden />
                Nhập Excel
              </button>
            )}
            <ExportExcelButton fetcher={adminCategoryService.exportXlsx} filePrefix="danh_muc_export" />
          </>
        }
      />

      <AdminCatalogImportModal open={importOpen} onClose={() => setImportOpen(false)} kind="category" />

      {/* Form modal */}
      <AddFormShell
        presentation="modal"
        open={formOpen && (editingId == null ? canCreate : canUpdate)}
        title={editingId == null ? 'Tạo danh mục mới' : `Chỉnh sửa danh mục #${editingId}`}
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
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            Mã danh mục <span className="font-normal text-[var(--danger)]">*</span>
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="VD: PHONE, LAPTOP"
              className={inputCls}
              maxLength={64}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            Tên hiển thị <span className="font-normal text-[var(--danger)]">*</span>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="VD: Điện thoại"
              className={inputCls}
              maxLength={255}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            Danh mục cha
            <select
              value={form.parentIdStr}
              onChange={(e) => setForm((p) => ({ ...p, parentIdStr: e.target.value }))}
              className={inputCls}
            >
              <option value="">Không có — danh mục gốc</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.id} · {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">
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

          {/* Ảnh đại diện — chiếm cả 2 cột */}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Ảnh đại diện</p>
            <div className="flex flex-col gap-2">
              {/* Preview banner 240×50 */}
              <div className="flex flex-col gap-2 w-full">
                <div className="relative w-[240px] h-[50px] flex-shrink-0">
                  {displayThumbnail ? (
                    <>
                      <img
                        src={displayThumbnail}
                        alt="Ảnh đại diện"
                        className="w-[240px] h-[50px] rounded-lg border border-[var(--bg-border)] object-cover"
                      />
                      {thumbnailFile && (
                        <button
                          type="button"
                          onClick={resetThumbnail}
                          aria-label="Bỏ chọn ảnh"
                          className={clsx(
                            'absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full',
                            'bg-[var(--bg-surface)] border border-[var(--bg-border)] text-[var(--text-secondary)]',
                            'hover:text-[var(--danger)] transition-colors shadow-sm'
                          )}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex w-[240px] h-[50px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)]">
                      <ImagePlus className="size-4" aria-hidden />
                      <span className="text-[11px]">240 × 50 px</span>
                    </div>
                  )}
                </div>

                {/* Upload button + hint */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg border border-[var(--bg-border)] px-3 py-1.5',
                      'text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    )}
                  >
                    <ImagePlus className="size-3.5" aria-hidden />
                    {displayThumbnail ? 'Đổi ảnh' : 'Chọn ảnh'}
                  </button>
                  <div className="flex flex-col">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Khuyến nghị: 240 × 50 px · jpg, png, webp · tối đa 5 MB
                    </p>
                    {thumbnailFile && (
                      <p className="max-w-[220px] truncate text-[11px] text-[var(--text-secondary)]">
                        {thumbnailFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onFileChange}
              />
            </div>
          </div>
        </div>
      </AddFormShell>

      {/* Search + stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Tìm danh mục</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm theo tên, mã hoặc ID…"
            className={clsx(inputCls, 'w-full pl-9')}
          />
        </label>
        <p className="shrink-0 text-xs text-[var(--text-muted)]">
          {rootCategories.length || '…'} gốc · {flatList.length || '…'} tổng
        </p>
      </div>

      {/* Permission notice */}
      {!canCreate && !canUpdate ? (
        <p className="rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
          Bạn chỉ có quyền xem danh sách danh mục.
        </p>
      ) : null}

      {/* Main content */}
      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin text-[var(--accent)]" aria-hidden />
          Đang tải…
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--bg-surface)] p-6 text-sm text-[var(--danger)]">
          {getApiErrorMessage(listQuery.error, 'Không tải được danh sách danh mục.')}
        </div>
      ) : rootCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] py-16 text-center">
          <FolderTree className="size-8 text-[var(--text-muted)]" aria-hidden />
          <p className="text-sm text-[var(--text-secondary)]">
            {canCreate ? 'Chưa có danh mục nào.' : 'Chưa có danh mục trong hệ thống.'}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => openCreate()}
              className="mt-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Thêm danh mục đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">

          {/* Left: root categories */}
          <aside className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
            <div className="border-b border-[var(--bg-border)] px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Danh mục gốc</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredRoots.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-[var(--text-muted)]">
                  Không tìm thấy kết quả.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredRoots.map((r) => {
                    const active = r.id === selectedParentId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedParentId(r.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            if (canUpdate) startEdit(r);
                          }}
                          className={clsx(
                            'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                              : 'border-transparent hover:bg-[var(--bg-elevated)]/80 text-[var(--text-primary)]',
                          )}
                        >
                          <CategoryAvatar
                            thumbnailUrl={r.thumbnailUrl}
                            name={r.name}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            <span className="block text-[11px] text-[var(--text-muted)]">
                              {r.code}
                              {(r.childrenCount ?? 0) > 0 ? ` · ${r.childrenCount} danh mục con` : ''}
                            </span>
                          </span>
                          {active && <ChevronRight className="size-4 shrink-0 text-[var(--accent)]" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Right: child categories */}
          <section className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bg-border)] px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Danh mục con</p>
                {selectedParent && (
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-primary)]">
                    {selectedParent.name}
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                      #{selectedParent.id} · {selectedParent.code}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canCreate && selectedParentId != null ? (
                  <button
                    type="button"
                    onClick={() => openCreate(selectedParentId)}
                    className={clsx(
                      'shrink-0 rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-semibold',
                      'text-[var(--accent)] hover:bg-[var(--accent-soft)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    )}
                  >
                    + Thêm danh mục con
                  </button>
                ) : null}
                {canDelete && selectedParent != null ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(selectedParent)}
                    className={clsx(
                      'inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-semibold',
                      'text-[var(--danger)] hover:bg-[var(--danger)]/10',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]'
                    )}
                    title="Xóa danh mục gốc đang chọn (phải không còn con & sản phẩm)"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Xóa danh mục
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              {selectedParentId == null ? (
                <p className="p-8 text-center text-sm text-[var(--text-muted)]">
                  Chọn một danh mục gốc ở cột trái.
                </p>
              ) : filteredChildren.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <FolderTree className="size-6 text-[var(--text-muted)]" aria-hidden />
                  <p className="text-sm text-[var(--text-muted)]">
                    {filter.trim()
                      ? 'Không tìm thấy kết quả.'
                      : 'Chưa có danh mục con trong nhóm này.'}
                  </p>
                  {!filter.trim() && canCreate && (
                    <button
                      type="button"
                      onClick={() => openCreate(selectedParentId)}
                      className="mt-1 rounded-lg border border-[var(--bg-border)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    >
                      + Thêm danh mục con
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/40">
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">ID</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">Mã</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">Tên</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">Con</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">Trạng thái</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">Cập nhật</th>
                      {(canUpdate || canDelete) && (
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-[var(--text-secondary)]">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChildren.map((c) => (
                      <tr
                        key={c.id}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          if (canUpdate) startEdit(c);
                        }}
                        className={clsx(
                          'border-b border-[var(--bg-border)]/60 transition-colors hover:bg-[var(--bg-elevated)]/40',
                          canUpdate ? 'cursor-pointer select-none' : ''
                        )}
                      >
                        <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs text-[var(--text-muted)]">
                          {c.id}
                        </td>
                        <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] text-xs font-medium text-[var(--text-primary)]">
                          {c.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CategoryAvatar thumbnailUrl={c.thumbnailUrl} name={c.name} size="sm" />
                            <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                          {c.childrenCount ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.status === 1 ? (
                            <StatusBadge tone="success" label={ADMIN_RECORD_STATUS_LABEL_VI.active} />
                          ) : (
                            <StatusBadge tone="neutral" label={ADMIN_RECORD_STATUS_LABEL_VI.inactive} />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">
                          {formatTimestamp(c.modifiedDate ?? c.createdDate)}
                        </td>
                        {(canUpdate || canDelete) && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(c);
                                  }}
                                  aria-label={`Sửa ${c.name}`}
                                  title="Sửa"
                                  className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDelete(c);
                                  }}
                                  aria-label={`Xóa ${c.name}`}
                                  title="Xóa"
                                  className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { Fragment, useCallback, type ReactNode } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { CatalogEntry, CrudColumnKey, PermissionMatrixRow } from '../../../lib/permissionCatalog';
import {
  CRUD_COLUMN_LABEL,
  CRUD_COLUMN_ORDER,
  cudCodesForModule,
  effectiveSetHasAnyEquivalent,
  equivalentCrudPermissionCodes,
  modulePrefixFromPermissionCode,
  readCodeForModule,
} from '../../../lib/permissionCatalog';
import { notify } from '../../../utils/notify';

// ─── Colour tokens ────────────────────────────────────────────────────────────

/** Trực tiếp cấp cho user */
const DIRECT_BG = '#dcfce7';
const DIRECT_RING = '#22c55e';
const DIRECT_FG = '#15803d';

/** Kế thừa từ chức vụ */
const ROLE_BG = '#e0f2fe';
const ROLE_RING = '#38bdf8';
const ROLE_FG = '#0369a1';

/** Hệ thống cấp (không gán qua UI) */
const SYS_BG = '#fef9c3';
const SYS_RING = '#fbbf24';
const SYS_FG = '#92400e';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ToggleCtx = {
  effectiveSet: ReadonlySet<number>;
  rolePermissionSet: ReadonlySet<number>;
  userPermissionSet: ReadonlySet<number>;
  canMutate: boolean;
  isCodeAssignable: (code: number) => boolean;
  busy: boolean;
  onGrantCodes: (codes: number[]) => Promise<void>;
  onRevokeCodes: (codes: number[]) => Promise<void>;
};

function collectAssignableCodesInColumn(
  rows: PermissionMatrixRow[],
  col: CrudColumnKey,
  isAssignable: (code: number) => boolean
): number[] {
  const s = new Set<number>();
  for (const row of rows) {
    for (const e of row.columns[col]) {
      if (isAssignable(e.code)) s.add(e.code);
    }
  }
  return [...s].sort((a, b) => a - b);
}

function collectAssignableCodesInRow(row: PermissionMatrixRow, isAssignable: (code: number) => boolean): number[] {
  const s = new Set<number>();
  for (const col of CRUD_COLUMN_ORDER) {
    for (const e of row.columns[col]) {
      if (isAssignable(e.code)) s.add(e.code);
    }
  }
  return [...s].sort((a, b) => a - b);
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function MatrixLegend() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--text-muted)]">
      <span className="font-semibold text-[var(--text-secondary)]">Chú giải:</span>
      <span className="flex items-center gap-1.5">
        <span
          className="flex size-5 items-center justify-center rounded-full border-2"
          style={{ borderColor: DIRECT_RING, backgroundColor: DIRECT_BG, color: DIRECT_FG }}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </span>
        Cấp trực tiếp
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="flex size-5 items-center justify-center rounded-full border-2"
          style={{ borderColor: ROLE_RING, backgroundColor: ROLE_BG, color: ROLE_FG }}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </span>
        Từ chức vụ
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="flex size-5 items-center justify-center rounded-full border-2"
          style={{ borderColor: SYS_RING, backgroundColor: SYS_BG, color: SYS_FG }}
        >
          <Lock className="size-2.5" strokeWidth={2} />
        </span>
        Hệ thống
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex size-5 items-center justify-center rounded-full border border-[var(--bg-border)] bg-[var(--bg-elevated)]">
          <X className="size-3 text-[var(--text-muted)]" strokeWidth={2} />
        </span>
        Chưa có
      </span>
    </div>
  );
}

// ─── Permission Toggle Cell ───────────────────────────────────────────────────

function CircularPermissionToggle({
  entry,
  ctx,
  column,
}: {
  entry: CatalogEntry;
  ctx: ToggleCtx;
  /** Cột CRUD hiện tại — dùng để áp rule READ prerequisite */
  column?: CrudColumnKey;
}) {
  const {
    effectiveSet,
    rolePermissionSet,
    userPermissionSet,
    canMutate,
    isCodeAssignable,
    busy,
    onGrantCodes,
    onRevokeCodes,
  } = ctx;

  const code = entry.code;
  const assignable = isCodeAssignable(code);
  const equivalents = equivalentCrudPermissionCodes(code);
  const directHits = equivalents.filter((c) => userPermissionSet.has(c));
  const effective = effectiveSetHasAnyEquivalent(effectiveSet, code);
  const isDirect = directHits.length > 0;
  const isFromRole =
    effective &&
    !isDirect &&
    equivalents.some((c) => rolePermissionSet.has(c));
  const canToggle = canMutate && assignable && !busy;
  const readOnlyEffective = !assignable && effective;

  const title = `${code}: ${entry.label}`;

  const runToggle = useCallback(async () => {
    if (!canToggle) return;

    if (!effective) {
      // ── GRANT ──────────────────────────────────────────────────────────────
      // Rule: Tạo / Cập nhật / Xóa yêu cầu có quyền Xem trước.
      if (column && column !== 'read') {
        const readCode = readCodeForModule(code);
        if (readCode != null && !effectiveSetHasAnyEquivalent(effectiveSet, readCode)) {
          // Tự động cấp READ cùng lúc
          await onGrantCodes([readCode, code]);
          notify.info('Đã tự động cấp quyền Xem vì đây là điều kiện bắt buộc.');
          return;
        }
      }
      await onGrantCodes([code]);
      return;
    }

    if (isDirect) {
      // ── REVOKE ─────────────────────────────────────────────────────────────
      // Rule: Khi thu hồi Xem → cũng thu hồi Tạo / Cập nhật / Xóa của module đó.
      if (column === 'read') {
        const cudDirect = cudCodesForModule(code).filter((c) => userPermissionSet.has(c));
        const toRevoke = [...new Set([...directHits, ...cudDirect])];
        await onRevokeCodes(toRevoke);
        if (cudDirect.length > 0) {
          notify.info('Đã thu hồi kèm các quyền Tạo / Cập nhật / Xóa phụ thuộc vào Xem.');
        }
        return;
      }
      await onRevokeCodes(directHits.length ? directHits : [code]);
      return;
    }

    if (isFromRole) {
      notify.info('Quyền này đang đến từ chức vụ — chỉnh chức vụ của tài khoản để bỏ quyền này.');
    }
  }, [
    canToggle, code, column, directHits, effective, effectiveSet,
    isDirect, isFromRole, onGrantCodes, onRevokeCodes, userPermissionSet,
  ]);

  // ── System-level ──
  if (readOnlyEffective) {
    return (
      <div className="flex flex-col items-center" title={`${title} (cấp bởi hệ thống)`}>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-all"
          style={{ borderColor: SYS_RING, backgroundColor: SYS_BG, color: SYS_FG }}
          aria-label={`${title} — hệ thống cấp`}
        >
          <Lock className="size-[14px]" strokeWidth={2} aria-hidden />
        </span>
      </div>
    );
  }

  // ── Has permission ──
  if (effective) {
    const bg = isDirect ? DIRECT_BG : ROLE_BG;
    const ring = isDirect ? DIRECT_RING : ROLE_RING;
    const fg = isDirect ? DIRECT_FG : ROLE_FG;
    const label = isDirect ? `${title} — cấp trực tiếp` : `${title} — từ chức vụ`;

    return (
      <div className="flex flex-col items-center" title={label}>
        <button
          type="button"
          disabled={!canToggle}
          onClick={() => void runToggle()}
          className={clsx(
            'flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)]',
            canToggle ? 'hover:brightness-95 active:scale-[0.94]' : 'cursor-default'
          )}
          style={{
            borderColor: ring,
            backgroundColor: bg,
            color: fg,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--tw-ring-color' as any]: ring,
          }}
          aria-pressed
          aria-label={label}
        >
          <Check className="size-[15px]" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    );
  }

  // ── No permission ──
  return (
    <div className="flex flex-col items-center" title={`${title} — chưa có quyền`}>
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => void runToggle()}
        className={clsx(
          'flex size-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-out',
          'bg-[var(--bg-elevated)] border-[var(--bg-border)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1',
          canToggle
            ? 'cursor-pointer hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)] active:scale-[0.94]'
            : 'cursor-not-allowed opacity-40'
        )}
        aria-pressed={false}
        aria-label={`${title} — chưa có quyền`}
      >
        <X className="size-[14px] text-[var(--text-muted)]" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

// ─── Cell: all entries for one (module × CRUD) ───────────────────────────────

function CellCircles({
  entries,
  ctx,
  idPrefix,
  column,
}: {
  entries: CatalogEntry[];
  ctx: ToggleCtx;
  idPrefix: string;
  column: CrudColumnKey;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-[52px] items-center justify-center px-2 py-2">
        <span
          className="inline-flex size-9 items-center justify-center rounded-full border border-dashed border-[var(--bg-border)] opacity-30"
          aria-hidden
        >
          <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
        </span>
      </div>
    );
  }
  const sorted = [...entries].sort((a, b) => a.code - b.code);
  return (
    <div className="flex flex-col items-center gap-2.5 py-2">
      {sorted.map((entry) => (
        <CircularPermissionToggle
          key={`${idPrefix}-${entry.code}`}
          entry={entry}
          ctx={ctx}
          column={column}
        />
      ))}
    </div>
  );
}

// ─── "Other" (non-CRUD) permissions ──────────────────────────────────────────

function entryListOther(entries: CatalogEntry[], ctx: ToggleCtx): ReactNode {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.code - b.code);
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-4 p-0">
      {sorted.map((entry) => (
        <li key={entry.code}>
          <CircularPermissionToggle entry={entry} ctx={ctx} />
        </li>
      ))}
    </ul>
  );
}

// ─── Column header bulk toggle ────────────────────────────────────────────────

const CRUD_ACCENT: Record<string, { active: string; rest: string }> = {
  create: { active: 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', rest: '' },
  read: { active: 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-400', rest: '' },
  update: { active: 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400', rest: '' },
  delete: { active: 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-400', rest: '' },
};

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  rows: PermissionMatrixRow[];
  effectiveSet: ReadonlySet<number>;
  rolePermissionSet: ReadonlySet<number>;
  userPermissionSet: ReadonlySet<number>;
  canMutate: boolean;
  isCodeAssignable: (code: number) => boolean;
  busy?: boolean;
  onGrantCodes: (codes: number[]) => Promise<void>;
  onRevokeCodes: (codes: number[]) => Promise<void>;
};

export function PermissionCrudMatrixEditor({
  rows,
  effectiveSet,
  rolePermissionSet,
  userPermissionSet,
  canMutate,
  isCodeAssignable,
  busy = false,
  onGrantCodes,
  onRevokeCodes,
}: Props) {
  const ctx: ToggleCtx = {
    effectiveSet,
    rolePermissionSet,
    userPermissionSet,
    canMutate,
    isCodeAssignable,
    busy,
    onGrantCodes,
    onRevokeCodes,
  };

  // ── Column bulk toggle ────────────────────────────────────────────────────
  const runColumnBulk = useCallback(
    async (col: CrudColumnKey) => {
      if (!canMutate || busy) return;
      const codes = collectAssignableCodesInColumn(rows, col, isCodeAssignable);
      if (codes.length === 0) {
        notify.info('Không có quyền nào có thể gán trong cột này.');
        return;
      }
      const allOn = codes.every((c) => effectiveSetHasAnyEquivalent(effectiveSet, c));

      if (allOn) {
        // ── Revoke all in column ──
        let toRevoke = [
          ...new Set(
            codes.flatMap((c) =>
              equivalentCrudPermissionCodes(c).filter((x) => userPermissionSet.has(x))
            )
          ),
        ];
        // Rule: Thu hồi Xem → cũng thu hồi CUD
        if (col === 'read') {
          const cudDirect = codes
            .flatMap((c) => cudCodesForModule(c))
            .filter((c) => userPermissionSet.has(c));
          toRevoke = [...new Set([...toRevoke, ...cudDirect])];
          if (cudDirect.length > 0) {
            notify.info('Đã thu hồi kèm các quyền Tạo / Cập nhật / Xóa phụ thuộc vào Xem.');
          }
        }
        if (toRevoke.length > 0) await onRevokeCodes(toRevoke);
        else notify.info('Các quyền trong cột đang đến từ chức vụ — chỉnh chức vụ để bỏ.');
      } else {
        // ── Grant missing in column ──
        const toGrant = codes.filter((c) => !effectiveSetHasAnyEquivalent(effectiveSet, c));
        let allToGrant = [...toGrant];

        // Rule: Cấp CUD → tự động bao gồm Xem nếu chưa có
        if (col !== 'read') {
          const readCodes = collectAssignableCodesInColumn(rows, 'read', isCodeAssignable);
          const missingRead = readCodes.filter(
            (rc) => !effectiveSetHasAnyEquivalent(effectiveSet, rc)
          );
          if (missingRead.length > 0) {
            allToGrant = [...new Set([...missingRead, ...allToGrant])];
            notify.info('Đã tự động cấp quyền Xem vì đây là điều kiện bắt buộc.');
          }
        }

        if (allToGrant.length > 0) await onGrantCodes(allToGrant);
      }
    },
    [busy, canMutate, effectiveSet, isCodeAssignable, onGrantCodes, onRevokeCodes, rows, userPermissionSet]
  );

  // ── Row bulk toggle ───────────────────────────────────────────────────────
  const runRowBulk = useCallback(
    async (row: PermissionMatrixRow) => {
      if (!canMutate || busy) return;
      const codes = collectAssignableCodesInRow(row, isCodeAssignable);
      if (codes.length === 0) {
        notify.info('Không có quyền nào có thể gán trên phân hệ này.');
        return;
      }
      const allOn = codes.every((c) => effectiveSetHasAnyEquivalent(effectiveSet, c));
      if (allOn) {
        // Revoke all in row — READ thu hồi kéo theo CUD, nhưng nếu grant all thì đều có,
        // nên revoke tất cả codes là đủ (không cần cascade thêm)
        const toRevoke = [
          ...new Set(
            codes.flatMap((c) =>
              equivalentCrudPermissionCodes(c).filter((x) => userPermissionSet.has(x))
            )
          ),
        ];
        if (toRevoke.length > 0) await onRevokeCodes(toRevoke);
        else notify.info('Các quyền trong phân hệ đang đến từ chức vụ — chỉnh chức vụ để bỏ.');
      } else {
        // Grant missing in row — READ luôn được bao gồm trong toGrant nếu chưa có
        const toGrant = codes.filter((c) => !effectiveSetHasAnyEquivalent(effectiveSet, c));
        if (toGrant.length > 0) await onGrantCodes(toGrant);
      }
    },
    [busy, canMutate, effectiveSet, isCodeAssignable, onGrantCodes, onRevokeCodes, userPermissionSet]
  );

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Chưa có dữ liệu để hiển thị bảng quyền.</p>;
  }

  const bulkDisabled = !canMutate || busy;
  const gridCols = `minmax(160px,1fr) repeat(${CRUD_COLUMN_ORDER.length}, minmax(80px, 1fr))`;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]"
      data-permission-matrix="true"
    >
      {/* Header bar */}
      <div className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]/60 px-5 py-3">
        <MatrixLegend />
        {/* Column header row */}
        <div className="grid items-center gap-x-3" style={{ gridTemplateColumns: gridCols }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Phân hệ
          </div>
          {CRUD_COLUMN_ORDER.map((key) => {
            const codes = collectAssignableCodesInColumn(rows, key, isCodeAssignable);
            const allOn =
              codes.length > 0 && codes.every((c) => effectiveSetHasAnyEquivalent(effectiveSet, c));
            const accent = CRUD_ACCENT[key];
            return (
              <div key={key} className="flex justify-center">
                <button
                  type="button"
                  disabled={bulkDisabled}
                  onClick={() => void runColumnBulk(key)}
                  title={
                    allOn
                      ? `Bỏ tất cả quyền ${CRUD_COLUMN_LABEL[key]}`
                      : `Gán tất cả quyền ${CRUD_COLUMN_LABEL[key]}`
                  }
                  className={clsx(
                    'rounded-full border px-5 py-2 text-center text-[12px] font-semibold transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1',
                    !bulkDisabled && 'active:scale-[0.97]',
                    bulkDisabled && 'cursor-not-allowed opacity-40',
                    allOn && accent
                      ? accent.active
                      : 'border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]'
                  )}
                >
                  {CRUD_COLUMN_LABEL[key]}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--bg-border)]/60">
        {rows.map((row) => {
          const rowCodes = collectAssignableCodesInRow(row, isCodeAssignable);
          const rowAllOn =
            rowCodes.length > 0 && rowCodes.every((c) => effectiveSetHasAnyEquivalent(effectiveSet, c));

          return (
            <Fragment key={row.moduleKey}>
              <div
                className="grid items-center gap-x-3 px-5 transition-colors duration-150 hover:bg-[var(--bg-elevated)]/30"
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* Module label + row bulk toggle */}
                <div className="flex flex-col justify-center py-4 pe-3">
                  <button
                    type="button"
                    disabled={bulkDisabled}
                    onClick={() => void runRowBulk(row)}
                    title={
                      rowAllOn
                        ? `Bỏ tất cả quyền: ${row.moduleLabel}`
                        : `Gán tất cả quyền: ${row.moduleLabel}`
                    }
                    className={clsx(
                      'group flex items-center gap-2 text-left text-sm font-medium transition-colors',
                      !bulkDisabled && 'cursor-pointer hover:text-[var(--accent)]',
                      bulkDisabled && 'cursor-default',
                      rowAllOn ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                    )}
                  >
                    <span
                      className={clsx(
                        'h-4 w-0.5 shrink-0 rounded-full transition-colors',
                        rowAllOn
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--bg-border)] group-hover:bg-[var(--accent)]/50'
                      )}
                      aria-hidden
                    />
                    {row.moduleLabel}
                  </button>
                  {row.other.length > 0 ? (
                    <p className="mt-1 ps-2.5 text-[10px] text-[var(--text-muted)]">
                      +{row.other.length} quyền bổ sung (phía dưới)
                    </p>
                  ) : null}
                </div>

                {/* CRUD cells */}
                {CRUD_COLUMN_ORDER.map((key) => (
                  <div key={key} className="flex items-center justify-center px-1">
                    <CellCircles
                      entries={row.columns[key as CrudColumnKey]}
                      ctx={ctx}
                      idPrefix={`m-${row.moduleKey}-${key}`}
                      column={key as CrudColumnKey}
                    />
                  </div>
                ))}
              </div>

              {/* "Other" permissions expand panel */}
              {row.other.length > 0 ? (
                <div className="bg-[var(--bg-elevated)]/30 px-5 py-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Quyền bổ sung — {row.moduleLabel}
                  </p>
                  <div className="max-h-52 overflow-auto pe-1">
                    {entryListOther(row.other, ctx)}
                  </div>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

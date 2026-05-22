import type { PermissionCatalogData } from '../api/types/adminAccessControl.types';

/** @see docs/ADMIN_PERMISSION_CATALOG_FE.md — gộp catalogue sản phẩm */
const PRODUCT_CATALOG_LEGACY_PREFIXES: readonly number[] = [100, 150, 160, 170, 200];

/** @see docs/ADMIN_PERMISSION_CATALOG_FE.md — staff (400) + user admin → 700 */
const USER_MANAGEMENT_LEGACY_PREFIXES: readonly number[] = [400, 700];

export type CatalogEntry = {
  code: number;
  label: string;
  description?: string;
  group?: string;
};

/**
 * Mã quyền toàn hệ thống (3 chữ số) — không hiển thị / không gán qua UI.
 * Nguồn: PermissionCode.java — CREATE_ALL…DELETE_ALL, LOCK_USER, MANAGE_ROLE, GRANT_PERMISSION.
 */
export const SYSTEM_WIDE_NON_ASSIGNABLE_PERMISSION_CODES = new Set<number>([
  101, 102, 103, 104,
]);

/** @deprecated dùng SYSTEM_WIDE_NON_ASSIGNABLE_PERMISSION_CODES */
export const SYSTEM_WILDCARD_PERMISSION_CODES = SYSTEM_WIDE_NON_ASSIGNABLE_PERMISSION_CODES;

export function isSystemWideNonAssignablePermissionCode(code: number): boolean {
  return SYSTEM_WIDE_NON_ASSIGNABLE_PERMISSION_CODES.has(code);
}

/** Giữ tên cũ — cùng nghĩa với `isSystemWideNonAssignablePermissionCode`. */
export function isSystemWildcardPermissionCode(code: number): boolean {
  return isSystemWideNonAssignablePermissionCode(code);
}

/** Quyền được hiển thị và có thể tick trong form cấp quyền / gán role (không gồm mã hệ thống 3 chữ số). */
export function isAssignablePermissionCodeViaUi(code: number): boolean {
  return !isSystemWideNonAssignablePermissionCode(code);
}

export type CrudColumnKey = 'create' | 'read' | 'update' | 'delete';

export const CRUD_COLUMN_ORDER: CrudColumnKey[] = ['create', 'read', 'update', 'delete'];

export const CRUD_COLUMN_LABEL: Record<CrudColumnKey, string> = {
  create: 'Tạo',
  read: 'Xem',
  update: 'Cập nhật',
  delete: 'Xóa',
};

const WILDCARD_CODE_TO_CRUD: Partial<Record<number, CrudColumnKey>> = {
  101: 'create',
  102: 'read',
  103: 'update',
  104: 'delete',
};

/** Tiêu đề hàng ma trận theo tiền tố chuẩn (sau gộp module). @see docs/ADMIN_PERMISSION_CATALOG_FE.md */
export const PERMISSION_MODULE_PREFIX_VI: Record<number, string> = {
  100: 'Sản phẩm',
  150: 'Giá',
  160: 'Đơn vị tính',
  170: 'Thương hiệu',
  200: 'Danh mục',
  300: 'Tài liệu',
  400: 'Nhân viên',
  500: 'Đơn hàng',
  600: 'Báo cáo',
  700: 'Quản lý user',
  800: 'Chức vụ',
  900: 'Phân quyền',
};

export function modulePrefixFromPermissionCode(code: number): number | null {
  if (!Number.isFinite(code) || code < 1000) return null;
  const prefix = Math.floor(code / 1000);
  return prefix > 0 ? prefix : null;
}

/**
 * Tiền tố hàng ma trận / module chuẩn.
 */
export function canonicalModulePrefixForPermissionCode(code: number): number | null {
  return modulePrefixFromPermissionCode(code);
}

function crudActionIndexFromCode(code: number): number | null {
  if (!Number.isFinite(code)) return null;
  if (code < 1000) {
    const col = WILDCARD_CODE_TO_CRUD[code];
    return col != null ? CRUD_COLUMN_ORDER.indexOf(col) + 1 : null;
  }
  const tail = code % 1000;
  if (tail >= 1 && tail <= 4) return tail;
  return null;
}

/**
 * Các mã CRUD xem là tương đương khi đọc hiệu lực / gộp hàng (catalogue + user).
 * Không áp dụng cho mã 3 chữ số hoặc hành động không phải 001–004.
 */
export function equivalentCrudPermissionCodes(code: number): number[] {
  if (!Number.isFinite(code) || code < 1000) return [code];

  const actionIdx = crudActionIndexFromCode(code);
  if (actionIdx == null) return [code];

  const raw = modulePrefixFromPermissionCode(code);
  if (raw == null) return [code];

  const out = new Set<number>();
  const addRange = (prefixes: readonly number[]) => {
    for (const p of prefixes) out.add(p * 1000 + actionIdx);
  };

  if (PRODUCT_CATALOG_LEGACY_PREFIXES.includes(raw)) {
    addRange(PRODUCT_CATALOG_LEGACY_PREFIXES);
  } else if (USER_MANAGEMENT_LEGACY_PREFIXES.includes(raw)) {
    addRange(USER_MANAGEMENT_LEGACY_PREFIXES);
  } else {
    out.add(code);
  }
  return [...out].sort((a, b) => a - b);
}

export function effectiveSetHasAnyEquivalent(effective: ReadonlySet<number>, code: number): boolean {
  for (const c of equivalentCrudPermissionCodes(code)) {
    if (effective.has(c)) return true;
  }
  return false;
}

/** Khi mọi mã trong nhóm cùng một module (theo chuẩn gộp) → tiêu đề tiếng Việt. */
export function formatPermissionModuleTitleFromCodes(codes: number[]): string | null {
  const prefixes = new Set<number>();
  for (const c of codes) {
    const p = canonicalModulePrefixForPermissionCode(c);
    if (p != null) prefixes.add(p);
  }
  if (prefixes.size !== 1) return null;
  const only = [...prefixes][0]!;
  return PERMISSION_MODULE_PREFIX_VI[only] ?? null;
}

const GROUP_KEY_ALIAS_VI: Record<string, string> = {
  PRODUCT: 'Sản phẩm',
  PRODUCTS: 'Sản phẩm',
  PRODUCT_FAMILY: 'Sản phẩm',
  PRICE: 'Sản phẩm',
  UNIT: 'Sản phẩm',
  BRAND: 'Sản phẩm',
  CATEGORY: 'Sản phẩm',
  DOCUMENT: 'Tài liệu',
  DOCUMENTS: 'Tài liệu',
  EMPLOYEE: 'Quản lý user',
  EMPLOYEES: 'Quản lý user',
  USER_MANAGEMENT: 'Quản lý user',
  ORDER: 'Đơn hàng',
  ORDERS: 'Đơn hàng',
  REPORT: 'Báo cáo',
  REPORTING: 'Báo cáo',
  USER: 'Quản lý user',
  USERS: 'Quản lý user',
  ROLE: 'Chức vụ',
  ROLES: 'Chức vụ',
  PERMISSION: 'Phân quyền',
  PERMISSIONS: 'Phân quyền',
};

export type PermissionMatrixRow = {
  moduleKey: string;
  moduleLabel: string;
  columns: Record<CrudColumnKey, CatalogEntry[]>;
  other: CatalogEntry[];
};

/**
 * Gắn một mục catalog vào cột CRUD (heuristic: wildcard, hậu tố 001–004, từ khoá).
 */
export function classifyCatalogEntryToCrud(entry: CatalogEntry): CrudColumnKey | null {
  const explicit = WILDCARD_CODE_TO_CRUD[entry.code];
  if (explicit) return explicit;

  const tail = entry.code % 1000;
  if (tail >= 1 && tail <= 4) {
    return CRUD_COLUMN_ORDER[tail - 1]!;
  }

  const hay = `${entry.label} ${entry.description ?? ''}`.toUpperCase();
  if (/\bCREATE\b|CREATE_|_CREATE\b|TẠO\b/.test(hay)) return 'create';
  if (/\bREAD\b|READ_|_READ\b|XEM\b|ĐỌC\b/.test(hay)) return 'read';
  if (/\bUPDATE\b|UPDATE_|_UPDATE\b|CẬP NHẬT\b/.test(hay)) return 'update';
  if (/\bDELETE\b|DELETE_|_DELETE\b|XOÁ\b|XÓA\b/.test(hay)) return 'delete';

  return null;
}

export function formatCatalogModuleLabel(group: string): string {
  const known: Record<string, string> = {
    systemWide: 'Toàn hệ thống',
    moduleSpecific: 'Tổng hợp module',
    actions: 'Hành động',
    allKnownCodes: 'Danh mục mã (catalog)',
    Khác: 'Khác',
  };
  if (known[group]) return known[group];

  const stripped = group.replace(/^MODULE_/i, '').trim();
  const slug = stripped.replace(/[\s-]+/g, '_').toUpperCase();
  if (GROUP_KEY_ALIAS_VI[slug]) return GROUP_KEY_ALIAS_VI[slug];

  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  if (!spaced) return group;
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Khóa hàng ma trận: `mod:MMM` theo tiền tố chuẩn. */
export function matrixRowKeyForCatalogEntry(e: CatalogEntry): string {
  const prefix = modulePrefixFromPermissionCode(e.code);
  if (prefix != null) return `mod:${prefix}`;
  const g = e.group ?? 'Khác';
  return `grp:${g}`;
}

function matrixRowLabelFromKey(moduleKey: string): string {
  if (moduleKey.startsWith('mod:')) {
    const n = Number(moduleKey.slice(4));
    return PERMISSION_MODULE_PREFIX_VI[n] ?? `Phân hệ ${n}`;
  }
  const group = moduleKey.startsWith('grp:') ? moduleKey.slice(4) : moduleKey;
  return formatCatalogModuleLabel(group);
}

function matrixRowSortRank(row: PermissionMatrixRow): [number, number, string] {
  const k = row.moduleKey;
  if (k === 'grp:systemWide' || k.endsWith('systemWide')) return [-2, 0, k];
  if (k.startsWith('mod:')) {
    const n = Number(k.slice(4));
    return [0, Number.isFinite(n) ? n : 9999, k];
  }
  return [1, 0, row.moduleLabel];
}

export function buildPermissionMatrixRows(entries: CatalogEntry[]): PermissionMatrixRow[] {
  const byModule = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const key = matrixRowKeyForCatalogEntry(e);
    const list = byModule.get(key);
    if (list) list.push(e);
    else byModule.set(key, [e]);
  }

  const rows: PermissionMatrixRow[] = [];
  for (const [moduleKey, list] of byModule.entries()) {
    const columns: Record<CrudColumnKey, CatalogEntry[]> = {
      create: [],
      read: [],
      update: [],
      delete: [],
    };
    const other: CatalogEntry[] = [];
    for (const e of list) {
      const col = classifyCatalogEntryToCrud(e);
      if (col) columns[col].push(e);
      else other.push(e);
    }
    rows.push({
      moduleKey,
      moduleLabel: matrixRowLabelFromKey(moduleKey),
      columns,
      other,
    });
  }

  rows.sort((a, b) => {
    const ra = matrixRowSortRank(a);
    const rb = matrixRowSortRank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    if (ra[1] !== rb[1]) return ra[1] - rb[1];
    return ra[2].localeCompare(rb[2], 'vi');
  });
  return rows;
}

/** Ma trận chỉ gồm các mã hiệu lực (user/role) cắt với catalog. */
export function buildPermissionMatrixForCodeSet(
  codes: ReadonlySet<number>,
  catalogEntries: CatalogEntry[]
): PermissionMatrixRow[] {
  const subset = catalogEntries.filter((e) => codes.has(e.code));
  return buildPermissionMatrixRows(subset);
}

function tryReadCode(o: Record<string, unknown>): number | null {
  const raw = o.code ?? o.permissionCode ?? o.id ?? o.value;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function entryFromObject(o: Record<string, unknown>, group?: string): CatalogEntry | null {
  const code = tryReadCode(o);
  if (code == null) return null;
  const label =
    o.label != null
      ? String(o.label)
      : o.name != null
        ? String(o.name)
        : o.constant != null
          ? String(o.constant)
          : String(code);
  const description = o.description != null ? String(o.description) : undefined;
  return { code, label, description, group };
}

function walkArray(arr: unknown[], group: string | undefined, out: CatalogEntry[], seen: Set<number>) {
  for (const item of arr) {
    if (item == null) continue;
    if (typeof item === 'number' && Number.isFinite(item)) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push({ code: item, label: String(item), group });
      }
      continue;
    }
    if (typeof item === 'object' && !Array.isArray(item)) {
      const e = entryFromObject(item as Record<string, unknown>, group);
      if (e && !seen.has(e.code)) {
        seen.add(e.code);
        out.push(e);
      }
    }
  }
}

/**
 * Chuẩn hoá catalog BE (cấu trúc có thể khác seed) thành danh sách mã + nhãn.
 * @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md §3.4
 * @see docs/ADMIN_PERMISSION_CATALOG_FE.md
 */
export function flattenPermissionCatalog(raw: PermissionCatalogData | null | undefined): CatalogEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: CatalogEntry[] = [];
  const seen = new Set<number>();

  for (const key of ['systemWide', 'moduleSpecific', 'actions'] as const) {
    const v = raw[key];
    if (Array.isArray(v)) walkArray(v, key, out, seen);
  }

  const mods = raw.modules;
  if (mods && typeof mods === 'object' && !Array.isArray(mods)) {
    for (const [modName, val] of Object.entries(mods as Record<string, unknown>)) {
      if (Array.isArray(val)) walkArray(val, modName, out, seen);
    }
  }

  const akc = raw.allKnownCodes;
  if (Array.isArray(akc)) walkArray(akc, 'allKnownCodes', out, seen);

  // Lọc bỏ các quyền phụ của Sản phẩm (Giá, Đơn vị tính, Thương hiệu, Danh mục) và Nhân viên
  // Chỉ giữ lại quyền quản lý chính (100 và 700)
  return out
    .filter((e) => {
      if (e.group === 'systemWide') return false;
      if (isSystemWideNonAssignablePermissionCode(e.code)) return false;
      
      const prefix = modulePrefixFromPermissionCode(e.code);
      if (prefix != null) {
        if (prefix !== 100 && PRODUCT_CATALOG_LEGACY_PREFIXES.includes(prefix)) return false;
        if (prefix !== 700 && USER_MANAGEMENT_LEGACY_PREFIXES.includes(prefix)) return false;
      }
      return true;
    })
    .sort((a, b) => a.code - b.code);
}

export function catalogEntriesByGroup(entries: CatalogEntry[]): Map<string, CatalogEntry[]> {
  const m = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const g = e.group ?? 'Khác';
    const list = m.get(g);
    if (list) list.push(e);
    else m.set(g, [e]);
  }
  return m;
}

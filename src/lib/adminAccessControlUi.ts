import { authService } from '../api/services/authService';

const ELEVATED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ROLE_SUPER_ADMIN',
  'ROLE_ADMIN',
  'ROLE_MANAGER',
] as const;

/** §1 — MANAGE_ROLE 111, READ_ALL 102 */
const ROLE_READ = ['111', 'MANAGE_ROLE', '102', 'READ_ALL'] as const;

/** @see docs/ADMIN_PERMISSION_CATALOG_FE.md — USER_MANAGEMENT: 700xxx (legacy 400xxx) */
const USER_READ = [
  '700002',
  '400002',
  'READ_USER_MANAGEMENT',
  'READ_EMPLOYEE',
  'READ_USER',
  '102',
  'READ_ALL',
] as const;
const USER_CREATE = [
  '700001',
  '400001',
  'CREATE_USER_MANAGEMENT',
  'CREATE_EMPLOYEE',
  'CREATE_USER',
  '101',
  'CREATE_ALL',
] as const;
const USER_UPDATE = [
  '700003',
  '400003',
  'UPDATE_USER_MANAGEMENT',
  'UPDATE_EMPLOYEE',
  'UPDATE_USER',
  '103',
  'UPDATE_ALL',
] as const;
const USER_DELETE = [
  '700004',
  '400004',
  'DELETE_USER_MANAGEMENT',
  'DELETE_EMPLOYEE',
  'DELETE_USER',
  '104',
  'DELETE_ALL',
] as const;
const USER_LOCK = ['110', 'LOCK_USER', '103', 'UPDATE_ALL'] as const;

/** §3 — grant / revoke */
const PERMISSION_GRANT = ['112', 'GRANT_PERMISSION', '700003', 'UPDATE_USER', '103', 'UPDATE_ALL'] as const;

const ROLE_WRITE = ['111', 'MANAGE_ROLE', '103', 'UPDATE_ALL', '101', 'CREATE_ALL'] as const;
const ROLE_DELETE = ['111', 'MANAGE_ROLE', '104', 'DELETE_ALL'] as const;

// ─── Module READ codes ─────────────────────────────────────────────────────────
// Format: PREFIX*1000+2  (action 2 = read)
// READ_ALL (102) và elevated roles luôn bypass mọi check.
const READ_ALL = ['102', 'READ_ALL'] as const;

const PRODUCT_READ   = ['100002', ...READ_ALL] as const; // Sản phẩm
const STORE_READ     = ['250002', ...READ_ALL] as const; // Kho / cửa hàng
const STORE_CREATE   = ['250001', '101', 'CREATE_ALL'] as const;
const STORE_UPDATE   = ['250003', '103', 'UPDATE_ALL'] as const;
const STORE_DELETE   = ['250004', '104', 'DELETE_ALL'] as const;
const PRICE_READ     = ['150002', ...READ_ALL] as const; // Giá
const UNIT_READ      = ['160002', ...READ_ALL] as const; // Đơn vị tính
const BRAND_READ     = ['170002', ...READ_ALL] as const; // Thương hiệu
const CATEGORY_READ  = ['200002', ...READ_ALL] as const; // Danh mục
const DOCUMENT_READ  = ['300002', ...READ_ALL] as const; // Tài liệu
const ORDER_READ     = ['500002', ...READ_ALL] as const; // Đơn hàng
const REPORT_READ    = ['600002', ...READ_ALL] as const; // Báo cáo
const ROLE_READ_MOD  = ['800002', '111', 'MANAGE_ROLE', ...READ_ALL] as const; // Chức vụ (800)
const PERM_READ      = ['900002', '112', 'GRANT_PERMISSION', ...READ_ALL] as const; // Phân quyền

function hasElevatedRole(): boolean {
  return authService.hasAnyRole([...ELEVATED_ROLES]);
}

export const adminAccessControlUi = {
  canAssignSuperRoles: (): boolean =>
    authService.hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN']),

  /** Manager tạo NV: chỉ MANAGER / EMPLOYEE theo tài liệu */
  allowedRoleCodesForCreate: (): Set<string> | null => {
    if (adminAccessControlUi.canAssignSuperRoles()) return null;
    return new Set(['MANAGER', 'EMPLOYEE', 'ROLE_MANAGER', 'ROLE_EMPLOYEE']);
  },

  listRoles: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...ROLE_READ]),
  createRole: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...ROLE_WRITE]),
  updateRole: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...ROLE_WRITE]),
  deleteRole: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...ROLE_DELETE]),

  listUsers: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...USER_READ]),
  createUser: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...USER_CREATE]),
  updateUser: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...USER_UPDATE]),
  deleteUser: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...USER_DELETE]),
  lockUser: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...USER_LOCK, ...USER_UPDATE]),

  grantOrRevokePermission: (): boolean => hasElevatedRole() || authService.hasAnyPermission([...PERMISSION_GRANT]),

  // ── Quyền XEM theo module (READ prerequisite) ─────────────────────────────
  // Trả về true nếu user có ít nhất quyền Xem của module đó.
  // Dùng để ẩn nav item và block route.

  /** Dashboard — luôn hiển thị với mọi user đã đăng nhập */
  canViewDashboard: (): boolean => true,

  /** Sản phẩm (100xxx) */
  canViewProducts: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...PRODUCT_READ]),

  /** Kho / cửa hàng (250xxx) */
  canViewStores: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...STORE_READ]),
  canCreateStores: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...STORE_CREATE]),
  canUpdateStores: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...STORE_UPDATE]),
  canDeleteStores: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...STORE_DELETE]),

  /** Danh mục (200xxx) */
  canViewCategories: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...CATEGORY_READ]),

  /** Hãng / Thương hiệu (170xxx) */
  canViewBrands: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...BRAND_READ]),

  /** Giá & khuyến mãi (150xxx) — bao gồm các sub-route pricing/* */
  canViewPricing: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...PRICE_READ]),

  /** Đơn vị tính (160xxx) */
  canViewUnits: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...UNIT_READ]),

  /** Đơn hàng (500xxx) */
  canViewOrders: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...ORDER_READ]),

  /** Lịch sử hệ thống — chỉ elevated roles */
  canViewHistory: (): boolean => hasElevatedRole(),

  /** Nhân sự / User (700xxx / 400xxx legacy) */
  canViewUsers: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...USER_READ]),

  /** Chức vụ (800xxx) */
  canViewRoles: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...ROLE_READ_MOD]),

  /** Tài liệu (300xxx) */
  canViewDocuments: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...DOCUMENT_READ]),

  /** Báo cáo (600xxx) */
  canViewReports: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...REPORT_READ]),

  /** Phân quyền (900xxx) */
  canViewPermissions: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...PERM_READ]),

  /** Phòng ban (850xxx) — elevated hoặc có quyền user */
  canViewDepartments: (): boolean =>
    hasElevatedRole() || authService.hasAnyPermission([...USER_READ]),

  /** Cài đặt hệ thống — chỉ elevated roles */
  canViewSettings: (): boolean => hasElevatedRole(),
};

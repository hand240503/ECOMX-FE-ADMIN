/** @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md */

import type { UserAddress } from './auth.types';

export interface RoleResponse {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status?: number;
  permissionCodes?: number[];
}

export interface UpsertRoleRequest {
  code: string;
  name: string;
  description?: string | null;
  status?: number;
  permissionCodes?: number[];
}

/**
 * Đồng bộ với `user_info` sau đăng nhập (UserResponse) — không có access_token.
 * @see docs đồng bộ admin UserResponse
 */
export interface AdminUserResponse {
  id: number;
  username?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  status?: number;
  type?: number | null;
  manId?: number | null;
  roles?: string[];
  roleIds?: number[];
  /** Hiệu lực quyền (UserResponse) — optional tùy BE */
  permissions?: number[];
  /** Một số BE dùng tên này thay cho `permissions` */
  effectivePermissions?: number[];
  /** Chỉ có khi BE sinh mật khẩu (tạo user / reset staff) — không lưu lâu */
  temporaryPassword?: string | null;
  userInfo?: {
    fullName?: string | null;
    telephone?: string | null;
    avatar?: string | null;
    managerId?: number | null;
    info01?: string | null;
    info02?: string | null;
    info03?: string | null;
    info04?: string | null;
  };
  defaultAddress?: UserAddress | null;
}

export interface AdminUsersListResult {
  items: AdminUserResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateAdminUserRequest {
  username: string;
  password: string;
  phoneNumber: string;
  email?: string | null;
  fullName?: string | null;
  telephone?: string | null;
  avatar?: string | null;
  managerId?: number | null;
  manId?: number | null;
  info01?: string | null;
  info02?: string | null;
  info03?: string | null;
  info04?: string | null;
  roleIds?: number[];
}

export interface AdminModUserInfoRequest {
  id: number;
  password?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  status?: number | null;
  type?: number | null;
  manId?: number | null;
  fullName?: string | null;
  telephone?: string | null;
  avatar?: string | null;
  managerId?: number | null;
  info01?: string | null;
  info02?: string | null;
  info03?: string | null;
  info04?: string | null;
  roleIds?: number[] | null;
}

/**
 * POST/PUT `/admin/staff`, `/admin/employees` — một `roleId` mỗi lần.
 * @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md
 */
export interface CreateStaffEmployeeUserRequest {
  username: string;
  /** Bỏ qua → BE sinh mật khẩu 6 số và trả `temporaryPassword` */
  password?: string | null;
  phoneNumber: string;
  email?: string | null;
  fullName?: string | null;
  telephone?: string | null;
  avatar?: string | null;
  managerId?: number | null;
  manId?: number | null;
  info01?: string | null;
  info02?: string | null;
  info03?: string | null;
  info04?: string | null;
  roleId?: number | null;
}

export interface StaffEmployeeModUserInfoRequest {
  id: number;
  password?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  status?: number | null;
  type?: number | null;
  manId?: number | null;
  fullName?: string | null;
  telephone?: string | null;
  avatar?: string | null;
  managerId?: number | null;
  info01?: string | null;
  info02?: string | null;
  info03?: string | null;
  info04?: string | null;
  roleId?: number | null;
  grantPermissionCodes?: number[];
  revokePermissionCodes?: number[];
  permissionGrantExpiresAt?: string | null;
}

/**
 * @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md
 * - `staff`: GET/POST/PUT/DELETE /admin/staff (không CUSTOMER)
 * - `employee`: chỉ EMPLOYEE — /admin/employees
 * - `customer`: CUSTOMER — /admin/customers (đọc)
 */
export type AdminPersonnelSegment = 'staff' | 'employee' | 'customer';

export interface UserPermissionsResponse {
  userId: number;
  username: string;
  roles: string[];
  rolePermissions: number[];
  userPermissions: number[];
  effectivePermissions: number[];
}

export interface GrantPermissionRequest {
  userId: number;
  permissionCodes: number[];
  expiresAt?: string | null;
}

export interface RevokePermissionRequest {
  userId: number;
  permissionCodes: number[];
}

/** BE trả cấu trúc động — flatten qua `flattenPermissionCatalog`. @see docs/ADMIN_PERMISSION_CATALOG_FE.md */
export type PermissionCatalogData = {
  systemWide?: unknown;
  moduleSpecific?: unknown;
  actions?: unknown;
  modules?: Record<string, unknown>;
  allKnownCodes?: unknown;
  catalogNote?: {
    mergedModules?: Array<{
      canonicalPrefix?: number;
      includesLegacyPrefixes?: number[];
    }>;
  };
} & Record<string, unknown>;

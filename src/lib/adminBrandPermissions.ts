import { authService } from '../api/services/authService';

/** @see docs/ADMIN_BRANDS.md — MODULE_PRODUCT / catalogue: 100xxx (legacy 170xxx) */
const READ = [
  '100002',
  '170002',
  'READ_PRODUCT',
  'READ_BRAND',
  '102',
  'READ_ALL',
] as const;
const CREATE = [
  '100001',
  '170001',
  'CREATE_PRODUCT',
  'CREATE_BRAND',
  '101',
  'CREATE_ALL',
] as const;
const UPDATE = [
  '100003',
  '170003',
  'UPDATE_PRODUCT',
  'UPDATE_BRAND',
  '103',
  'UPDATE_ALL',
] as const;
const DELETE = [
  '100004',
  '170004',
  'DELETE_PRODUCT',
  'DELETE_BRAND',
  '104',
  'DELETE_ALL',
] as const;

/**
 * Nhiều JWT admin chỉ gửi roles, không lặp lại toàn bộ permission granular —
 * khi đó vẫn hiển thị nút CRUD; API sẽ trả 403 nếu thực sự không được phép.
 * EMPLOYEE chỉ dùng danh sách quyền chi tiết (vd. chỉ 100002 hoặc 170002).
 */
const BRAND_UI_FULL_ROLE_HINTS = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ROLE_SUPER_ADMIN',
  'ROLE_ADMIN',
  'ROLE_MANAGER',
] as const;

function hasBrandUiElevatedRole(): boolean {
  return authService.hasAnyRole([...BRAND_UI_FULL_ROLE_HINTS]);
}

export const adminBrandPermissions = {
  canList: (): boolean => hasBrandUiElevatedRole() || authService.hasAnyPermission([...READ]),
  canCreate: (): boolean => hasBrandUiElevatedRole() || authService.hasAnyPermission([...CREATE]),
  canUpdate: (): boolean => hasBrandUiElevatedRole() || authService.hasAnyPermission([...UPDATE]),
  canDelete: (): boolean => hasBrandUiElevatedRole() || authService.hasAnyPermission([...DELETE]),
};

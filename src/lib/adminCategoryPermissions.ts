import { authService } from '../api/services/authService';

/** @see docs/ADMIN_CATEGORIES.md — MODULE_PRODUCT / catalogue: 100xxx (legacy 200xxx) */
const READ = [
  '100002',
  '200002',
  'READ_PRODUCT',
  'READ_CATEGORY',
  '102',
  'READ_ALL',
] as const;
const CREATE = [
  '100001',
  '200001',
  'CREATE_PRODUCT',
  'CREATE_CATEGORY',
  '101',
  'CREATE_ALL',
] as const;
const UPDATE = [
  '100003',
  '200003',
  'UPDATE_PRODUCT',
  'UPDATE_CATEGORY',
  '103',
  'UPDATE_ALL',
] as const;
const DELETE = [
  '100004',
  '200004',
  'DELETE_PRODUCT',
  'DELETE_CATEGORY',
  '104',
  'DELETE_ALL',
] as const;

const CATEGORY_UI_FULL_ROLE_HINTS = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ROLE_SUPER_ADMIN',
  'ROLE_ADMIN',
  'ROLE_MANAGER',
] as const;

function hasCategoryUiElevatedRole(): boolean {
  return authService.hasAnyRole([...CATEGORY_UI_FULL_ROLE_HINTS]);
}

export const adminCategoryPermissions = {
  canList: (): boolean => hasCategoryUiElevatedRole() || authService.hasAnyPermission([...READ]),
  canCreate: (): boolean => hasCategoryUiElevatedRole() || authService.hasAnyPermission([...CREATE]),
  canUpdate: (): boolean => hasCategoryUiElevatedRole() || authService.hasAnyPermission([...UPDATE]),
  canDelete: (): boolean => hasCategoryUiElevatedRole() || authService.hasAnyPermission([...DELETE]),
};

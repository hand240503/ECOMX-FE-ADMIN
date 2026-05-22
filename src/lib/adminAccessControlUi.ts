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
};

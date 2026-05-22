import type { AdminPersonnelSegment, AdminUserResponse } from '../api/types/adminAccessControl.types';

export function normalizeRoleCode(code: string): string {
  return code.replace(/^ROLE_/, '').toUpperCase();
}

export function isCustomerRoleCode(code: string): boolean {
  return normalizeRoleCode(code) === 'CUSTOMER';
}

export function isEmployeeRoleCode(code: string): boolean {
  return normalizeRoleCode(code) === 'EMPLOYEE';
}

/** Lọc theo role trên `AdminUserResponse` (tiện ích). */
export function userMatchesPersonnelSegment(u: AdminUserResponse, segment: AdminPersonnelSegment): boolean {
  const codes = (u.roles ?? []).map(normalizeRoleCode);
  if (segment === 'customer') {
    return codes.includes('CUSTOMER');
  }
  if (segment === 'employee') {
    return codes.includes('EMPLOYEE');
  }
  return !codes.includes('CUSTOMER');
}

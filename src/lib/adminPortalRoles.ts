import type { UserInfo } from '../api/types/auth.types';

/** Roles allowed under backend `{api.prefix}/admin/**` — see docs/ADMIN_PORTAL.md */
export const ADMIN_PORTAL_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as const;

export type AdminPortalRoleCode = (typeof ADMIN_PORTAL_ROLE_CODES)[number];

export function isPortalAdminUser(user: UserInfo | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some((r) =>
    ADMIN_PORTAL_ROLE_CODES.includes(r as AdminPortalRoleCode)
  );
}

import type { UserInfo } from '../api/types/auth.types';

export const storage = {
  setAccessToken: (token: string) => {
    localStorage.setItem('accessToken', token);
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem('accessToken');
  },

  setUser: (user: UserInfo) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser: (): UserInfo | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getFullName: (): string => {
    const user = storage.getUser();
    if (!user?.userInfo) return '';
    return user.userInfo.fullName || '';
  },

  hasRole: (role: string): boolean => {
    const user = storage.getUser();
    return user?.roles?.includes(role) || false;
  },

  hasPermission: (permission: string): boolean => {
    const user = storage.getUser();
    return user?.permissions?.includes(permission) || false;
  },

  isCustomer: (): boolean => {
    return storage.hasRole('ROLE_CUSTOMER');
  },

  isAdmin: (): boolean => {
    return storage.hasRole('ROLE_ADMIN');
  },

  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};

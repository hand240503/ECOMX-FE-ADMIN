import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type {
  AuthResponse,
  ChangeContactRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  SendOTPRequest,
  VerifyOTPRequest
} from '../types/auth.types';
import type { ApiResponse } from '../types/common.types';
import { clearClientStorageOnLogout } from '../../lib/logoutStorageCleanup';
import { isPortalAdminUser } from '../../lib/adminPortalRoles';
import { tokenStorage } from '../../utils/tokenStorage';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;

    const normalized = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isLikelyJwt = (token: string): boolean => token.split('.').length === 3;

const isJwtExpired = (token: string): boolean => {
  if (!isLikelyJwt(token)) return false;

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000;
};

type ProfileApiData = AuthResponse['user_info'] | { user_info: AuthResponse['user_info'] };
let inFlightProfileRequest: Promise<AuthResponse['user_info']> | null = null;

const compactObject = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const next: Partial<T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    const value = obj[key];
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    next[key] = value;
  });
  return next;
};

export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Dang nhap that bai');
    }

    if (!response.data.data) {
      throw new Error('Khong nhan duoc du lieu tu server');
    }

    const { access_token, refresh_token, user_info } = response.data.data;

    if (!access_token || !refresh_token) {
      throw new Error('Khong nhan duoc token tu server');
    }

    if (!isPortalAdminUser(user_info)) {
      throw new Error('Tai khoan khong co quyen truy cap Ecomx-admin');
    }

    tokenStorage.setTokens(access_token, refresh_token);
    tokenStorage.setUser(user_info);
    tokenStorage.getOrCreateDeviceId();

    return {
      user_info,
      access_token,
      refresh_token,
      token_type: response.data.data.token_type,
      expires_in: response.data.data.expires_in
    };
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<RegisterResponse>(API_ENDPOINTS.AUTH.REGISTER, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Dang ky that bai');
    }

    // Backend current register flow only guarantees user_info.
    // Keep optional fields mapped when backend starts returning tokens.
    const { access_token, refresh_token, user_info } = response.data.data;
    return {
      user_info,
      access_token,
      refresh_token,
      token_type: response.data.data.token_type,
      expires_in: response.data.data.expires_in
    };
  },

  sendOTP: async (data: SendOTPRequest): Promise<boolean> => {
    const response = await axiosInstance.post<ApiResponse<void>>(API_ENDPOINTS.AUTH.SEND_OTP, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Gui OTP that bai');
    }

    return true;
  },

  verifyEmail: async (data: VerifyOTPRequest): Promise<boolean> => {
    const response = await axiosInstance.post<ApiResponse<boolean>>(API_ENDPOINTS.AUTH.VERIFY_EMAIL, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Xac thuc that bai');
    }

    return response.data.data || false;
  },

  logout: async (): Promise<void> => {
    try {
      await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      const is401 = axios.isAxiosError(error) && error.response?.status === 401;

      // Access token het han -> refresh roi goi logout lai de BE revoke refresh token
      if (is401) {
        try {
          await authService.refreshToken();
          await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
        } catch (retryError) {
          console.error('Logout retry failed:', retryError);
        }
      } else {
        console.error('Logout API failed:', error);
      }
    } finally {
      tokenStorage.clear();
      clearClientStorageOnLogout();
    }
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<string> => {
    const response = await axiosInstance.post<ApiResponse<void>>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Yeu cau that bai');
    }

    return response.data.message;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<string> => {
    const response = await axiosInstance.post<ApiResponse<void>>(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Reset mat khau that bai');
    }

    return response.data.message;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<string> => {
    const response = await axiosInstance.post<ApiResponse<void>>(API_ENDPOINTS.USER.CHANGE_PASSWORD, data);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Doi mat khau that bai');
    }

    return response.data.message;
  },

  changeContact: async (data: ChangeContactRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<LoginResponse>(API_ENDPOINTS.USER.CHANGE_CONTACT, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Cap nhat thong tin lien he that bai');
    }

    const updated = response.data.data;
    const { access_token, refresh_token, user_info } = updated;

    if (!access_token || !refresh_token) {
      throw new Error('Khong nhan duoc token moi sau khi cap nhat thong tin lien he');
    }

    tokenStorage.setTokens(access_token, refresh_token);
    tokenStorage.setUser(user_info);

    return {
      user_info,
      access_token,
      refresh_token,
      token_type: updated.token_type,
      expires_in: updated.expires_in
    };
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error('Khong tim thay refresh token');
    }

    const response = await axiosInstance.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      {
        refreshToken,
        deviceId: tokenStorage.getOrCreateDeviceId()
      } as RefreshTokenRequest
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Refresh token that bai');
    }

    const { access_token, refresh_token, user_info } = response.data.data;

    if (!access_token || !refresh_token) {
      throw new Error('Khong nhan duoc token moi tu server');
    }

    if (!isPortalAdminUser(user_info)) {
      tokenStorage.clear();
      clearClientStorageOnLogout();
      throw new Error('Tai khoan khong co quyen truy cap Ecomx-admin');
    }

    tokenStorage.setTokens(access_token, refresh_token);
    tokenStorage.setUser(user_info);

    return {
      user_info,
      access_token,
      refresh_token,
      token_type: response.data.data.token_type,
      expires_in: response.data.data.expires_in
    };
  },

  fetchCurrentUser: async (): Promise<AuthResponse['user_info']> => {
    if (inFlightProfileRequest) {
      return inFlightProfileRequest;
    }

    inFlightProfileRequest = (async () => {
      const response = await axiosInstance.get<ApiResponse<ProfileApiData>>(API_ENDPOINTS.USER.PROFILE);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Khong the tai thong tin nguoi dung');
      }

      const payload = response.data.data;
      const user = 'user_info' in payload ? payload.user_info : payload;
      if (!isPortalAdminUser(user)) {
        tokenStorage.clear();
        clearClientStorageOnLogout();
        throw new Error('Tai khoan khong co quyen truy cap Ecomx-admin');
      }
      tokenStorage.setUser(user);
      return user;
    })();

    try {
      return await inFlightProfileRequest;
    } finally {
      inFlightProfileRequest = null;
    }
  },

  updateProfile: async (input: UpdateProfileRequest): Promise<AuthResponse['user_info']> => {
    const profilePayload = compactObject({
      fullName: input.fullName,
      telephone: input.telephone ?? input.phoneNumber,
      email: input.email,
      phoneNumber: input.phoneNumber,
      avatar: input.avatar,
      managerId: input.managerId,
      info01: input.info01,
      info02: input.info02,
      info03: input.info03,
      info04: input.info04,
    });

    const formData = new FormData();

    if (Object.keys(profilePayload).length > 0) {
      formData.append(
        'profile',
        new Blob([JSON.stringify(profilePayload)], { type: 'application/json' })
      );
    }

    if (input.avatarFile) {
      formData.append('file', input.avatarFile);
    }

    const response = await axiosInstance.post<ApiResponse<ProfileApiData>>(
      API_ENDPOINTS.USER.UPDATE_PROFILE,
      formData
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Khong the cap nhat thong tin nguoi dung');
    }

    const updatedPayload = response.data.data;
    const user = 'user_info' in response.data.data ? response.data.data.user_info : response.data.data;
    tokenStorage.setUser(user);
    return user;
  },

  changePassword: async (input: ChangePasswordRequest): Promise<void> => {
    const response = await axiosInstance.post<ApiResponse<void>>(
      API_ENDPOINTS.USER.CHANGE_PASSWORD,
      input
    );
    if (!response.data.success) {
      throw new Error(response.data.message || 'Thay đổi mật khẩu thất bại');
    }
  },

  getCurrentUser: (): AuthResponse['user_info'] | null => {
    return tokenStorage.getUser<AuthResponse['user_info']>();
  },

  isAuthenticated: (): boolean => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) return false;
    if (isJwtExpired(refreshToken)) return false;
    if (!accessToken) return true;

    // Access token het han van coi con session, interceptor se tu refresh khi goi API
    if (isJwtExpired(accessToken)) return true;

    return true;
  },

  getAccessToken: (): string | null => tokenStorage.getAccessToken(),

  getRefreshToken: (): string | null => tokenStorage.getRefreshToken(),

  hasRole: (role: string): boolean => {
    const user = authService.getCurrentUser();
    return user?.roles?.includes(role) || false;
  },

  hasPermission: (permission: string): boolean => {
    const user = authService.getCurrentUser();
    if (!user?.permissions?.length) return false;
    const want = String(permission);
    return user.permissions.some((p) => String(p) === want);
  },

  getFullName: (): string => {
    const user = authService.getCurrentUser();
    if (!user?.userInfo) return '';
    return user.userInfo.fullName || '';
  },

  getEmail: (): string => {
    const user = authService.getCurrentUser();
    return user?.email || '';
  },

  getAvatar: (): string | null => {
    const user = authService.getCurrentUser();
    return user?.userInfo?.avatar || null;
  },

  hasAnyRole: (roles: string[]): boolean => {
    const user = authService.getCurrentUser();
    if (!user?.roles) return false;
    return roles.some(role => user.roles.includes(role));
  },

  hasAllRoles: (roles: string[]): boolean => {
    const user = authService.getCurrentUser();
    if (!user?.roles) return false;
    return roles.every(role => user.roles.includes(role));
  },

  hasAnyPermission: (permissions: string[]): boolean => {
    const user = authService.getCurrentUser();
    if (!user?.permissions?.length) return false;
    const userPerms = user.permissions.map((p) => String(p));
    return permissions.some((permission) => userPerms.includes(String(permission)));
  },

  hasAllPermissions: (permissions: string[]): boolean => {
    const user = authService.getCurrentUser();
    if (!user?.permissions?.length) return false;
    const userPerms = user.permissions.map((p) => String(p));
    return permissions.every((permission) => userPerms.includes(String(permission)));
  },

  clearAuth: (): void => {
    tokenStorage.clear();
  }
};
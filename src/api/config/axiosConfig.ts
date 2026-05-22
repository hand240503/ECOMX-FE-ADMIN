import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../../utils/tokenStorage';
import { API_ENDPOINTS } from './apiEndpoints';

export const API_BASE_URL = 'http://localhost:8080/api/v1';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

const isAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return (
    url.includes(API_ENDPOINTS.AUTH.LOGIN) ||
    url.includes(API_ENDPOINTS.AUTH.REFRESH_TOKEN) ||
    url.includes(API_ENDPOINTS.AUTH.LOGOUT)
  );
};

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
      // Let browser set correct multipart boundary automatically.
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }

    /** Mọi request tới `/admin/**` (qua baseURL + path) cần đã đăng nhập — BE yêu cầu `Authorization: Bearer`; token lưu sau login. */
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(axiosInstance(originalRequest));
          },
          reject
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) throw new Error('Missing refresh token');

      // Dung axios thuong de tranh interceptor loop
      const refreshRes = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`, {
        refreshToken,
        deviceId: tokenStorage.getOrCreateDeviceId()
      });

      const data = refreshRes.data?.data;
      const newAccessToken = data?.access_token;
      const newRefreshToken = data?.refresh_token;

      if (!newAccessToken || !newRefreshToken) {
        throw new Error('Invalid refresh response');
      }

      tokenStorage.setTokens(newAccessToken, newRefreshToken);
      if (data.user_info) tokenStorage.setUser(data.user_info);

      processQueue(null, newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clear();
      // Thông báo toàn cục: phiên hết hạn — AuthProvider lắng nghe 'auth:changed' để redirect /login
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
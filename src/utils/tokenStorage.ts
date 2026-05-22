const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const DEVICE_ID_KEY = 'deviceId';
const AUTH_CHANGED_EVENT = 'auth:changed';

const emitAuthChanged = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getDeviceId: () => localStorage.getItem(DEVICE_ID_KEY),

  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  getOrCreateDeviceId: () => {
    const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (existingDeviceId) return existingDeviceId;

    const generatedDeviceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(DEVICE_ID_KEY, generatedDeviceId);
    return generatedDeviceId;
  },

  setUser: (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    emitAuthChanged();
  },

  getUser: <T>() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    emitAuthChanged();
  }
};

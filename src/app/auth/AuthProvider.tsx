import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../../api/services';
import type { AuthResponse } from '../../api/types/auth.types';
import { isPortalAdminUser } from '../../lib/adminPortalRoles';
import { notify } from '../../utils/notify';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthResponse['user_info'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bootstrapAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

let bootstrapAuthPromise: Promise<AuthResponse['user_info']> | null = null;

const fetchProfileOnce = () => {
  if (!bootstrapAuthPromise) {
    bootstrapAuthPromise = authService.fetchCurrentUser().finally(() => {
      bootstrapAuthPromise = null;
    });
  }

  return bootstrapAuthPromise;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [status, setStatus] = useState<AuthStatus>('unknown');
  const [user, setUser] = useState<AuthResponse['user_info'] | null>(null);

  const setAuthenticated = useCallback((nextUser: AuthResponse['user_info'] | null) => {
    if (!nextUser || !isPortalAdminUser(nextUser)) {
      authService.clearAuth();
      setUser(null);
      setStatus('unauthenticated');
      return;
    }
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const setUnauthenticated = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const bootstrapAuth = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setUnauthenticated();
      return;
    }

    const cachedUser = authService.getCurrentUser();
    if (cachedUser) {
      if (!isPortalAdminUser(cachedUser)) {
        authService.clearAuth();
        setUnauthenticated();
        return;
      }
      setAuthenticated(cachedUser);
      return;
    }

    try {
      const profile = await fetchProfileOnce();
      setAuthenticated(profile);
    } catch {
      authService.clearAuth();
      setUnauthenticated();
    }
  }, [setAuthenticated, setUnauthenticated]);

  const syncAuthState = useCallback(() => {
    if (!authService.isAuthenticated()) {
      setUnauthenticated();
      return;
    }

    const cachedUser = authService.getCurrentUser();
    if (cachedUser) {
      if (!isPortalAdminUser(cachedUser)) {
        authService.clearAuth();
        setUnauthenticated();
        return;
      }
      setAuthenticated(cachedUser);
      return;
    }

    setStatus('unknown');
    void bootstrapAuth();
  }, [bootstrapAuth, setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    queueMicrotask(() => {
      void bootstrapAuth();
    });
  }, [bootstrapAuth]);

  useEffect(() => {
    const onAuthChanged = () => {
      syncAuthState();
    };

    window.addEventListener('auth:changed', onAuthChanged);
    window.addEventListener('storage', onAuthChanged);
    return () => {
      window.removeEventListener('auth:changed', onAuthChanged);
      window.removeEventListener('storage', onAuthChanged);
    };
  }, [syncAuthState]);

  useEffect(() => {
    const onSessionExpired = () => {
      notify.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener('auth:sessionExpired', onSessionExpired);
    return () => {
      window.removeEventListener('auth:sessionExpired', onSessionExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'unknown',
      bootstrapAuth
    }),
    [bootstrapAuth, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

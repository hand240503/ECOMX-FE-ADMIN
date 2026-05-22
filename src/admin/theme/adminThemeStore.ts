import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminColorMode = 'light' | 'dark';

type AdminThemeState = {
  mode: AdminColorMode;
  setMode: (mode: AdminColorMode) => void;
  toggleMode: () => void;
};

export const useAdminThemeStore = create<AdminThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'ecomx-admin-theme' }
  )
);

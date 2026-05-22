import { storage } from '../utils/storage';

/** Dispatched after non-token browser cleanup so listeners can reset local UI state. */
export const LOGOUT_STORAGE_CLEANUP_EVENT = 'ecomx:logout-storage-cleanup';

/**
 * Clear browser data tied to the session when logging out (beyond `tokenStorage.clear()`).
 */
export function clearClientStorageOnLogout(): void {
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    storage.clear();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(LOGOUT_STORAGE_CLEANUP_EVENT));
}

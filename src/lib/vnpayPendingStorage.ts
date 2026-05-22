const STORAGE_KEY = 'ecomx_vnpay_pending_ctx';

export type VnpayPendingClientContext = {
  transactionPublicId: string;
  /** Cùng phiên với `transactionPublicId` — do `POST /orders` trả, không tự sinh trên FE. */
  checkoutSessionId?: number;
  /** `productId-unitId` — dùng xóa giỏ khi thanh toán thành công */
  lineKeys: string[];
};

export function saveVnpayPendingContext(ctx: VnpayPendingClientContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

export function readVnpayPendingContext(): VnpayPendingClientContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const transactionPublicIdRaw = o.transactionPublicId;
    const transactionPublicId =
      typeof transactionPublicIdRaw === 'number' && Number.isFinite(transactionPublicIdRaw)
        ? String(Math.trunc(transactionPublicIdRaw))
        : typeof transactionPublicIdRaw === 'string' && transactionPublicIdRaw.trim() !== ''
          ? transactionPublicIdRaw.trim()
          : '';
    const lineKeys = Array.isArray(o.lineKeys)
      ? o.lineKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : [];
    const cs = o.checkoutSessionId ?? o.checkout_session_id;
    const checkoutSessionId =
      typeof cs === 'number' && Number.isFinite(cs)
        ? Math.trunc(cs)
        : typeof cs === 'string' && cs.trim() !== ''
          ? Number.parseInt(cs, 10)
          : undefined;
    if (!transactionPublicId) return null;
    const out: VnpayPendingClientContext = { transactionPublicId, lineKeys };
    if (checkoutSessionId != null && Number.isFinite(checkoutSessionId) && checkoutSessionId > 0) {
      out.checkoutSessionId = checkoutSessionId;
    }
    return out;
  } catch {
    return null;
  }
}

export function clearVnpayPendingContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

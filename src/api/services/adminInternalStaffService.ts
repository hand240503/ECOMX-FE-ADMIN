/**
 * adminInternalStaffService.ts
 *
 * Service riêng cho nhân viên nội bộ (Staff).
 * Bao gồm logic tự sinh mã SAP, username, mật khẩu mặc định và upload ảnh đại diện.
 */

import axios from 'axios';
import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { CatalogImportResponse } from '../types/catalogImport.types';
import { downloadTemplateBlob, postImportFile } from './importHelpers';
import type {
  AdminUserResponse,
  AdminUsersListResult,
  StaffEmployeeModUserInfoRequest,
} from '../types/adminAccessControl.types';

// ─── SAP code helpers ─────────────────────────────────────────────────────────

/**
 * Sinh mã SAP ngẫu nhiên theo format: `SAP-YYYYMMDD-NNNNN`
 * Ví dụ: `SAP-20260529-748219`
 */
export function generateSapCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(100000 + Math.random() * 900000)); // 6 chữ số
  return `SAP-${y}${m}${d}-${rand}`;
}

/** Lấy 6 chữ số cuối của mã SAP */
export function sapCodeSuffix(sapCode: string): string {
  return sapCode.slice(-6);
}

/**
 * Tự sinh username từ mã SAP.
 * Format: `nv` + 6 chữ số cuối SAP.  Ví dụ: `nv748219`
 */
export function deriveUsername(sapCode: string): string {
  return `nv${sapCodeSuffix(sapCode)}`;
}

/**
 * Mật khẩu mặc định = 6 chữ số cuối mã SAP.
 * Dùng khi tạo mới và khi đặt lại mật khẩu (reset password).
 */
export function deriveDefaultPassword(sapCode: string): string {
  return sapCodeSuffix(sapCode);
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateInternalStaffPayload {
  /** Bắt buộc */
  fullName: string;
  /** Bắt buộc */
  email: string;
  /** Bắt buộc */
  phoneNumber: string;
  /** Mã SAP (tự sinh từ generateSapCode). Lưu vào info01. */
  sapCode: string;
  /**
   * Username tuỳ chỉnh.
   * Nếu bỏ trống → tự sinh từ mã SAP: `nv` + 5 số cuối.
   */
  username?: string;
  /** File ảnh đại diện (tuỳ chọn). Upload trực tiếp. */
  avatarFile?: File | null;
  /** Status: 1 = active, 0 = inactive */
  status?: number;
  /** ID role */
  roleId?: number | null;
  signal?: AbortSignal;
}

export interface UpdateInternalStaffPayload {
  id: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  /** Nếu có file mới → upload và lưu URL */
  avatarFile?: File | null;
  /** URL ảnh sẵn có (không đổi file) */
  avatarUrl?: string | null;
  status?: number;
  roleId?: number | null;
  password?: string | null;
  signal?: AbortSignal;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

const parseApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiResponse<unknown> | undefined;
    const fieldMsg = body?.errors?.find((e) => e.message)?.message;
    if (fieldMsg) return fieldMsg;
    if (body?.message) return body.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

function asPaginationMeta(raw: Record<string, unknown> | undefined) {
  if (!raw) return null;
  const total = Number(raw.totalElements ?? raw.total_elements ?? 0);
  const pages = Number(raw.totalPages ?? raw.total_pages ?? 1);
  const page = Number(raw.number ?? raw.page ?? 0);
  const size = Number(raw.size ?? raw.pageSize ?? 10);
  return { totalElements: total, totalPages: pages, page, size };
}

async function parsePagedList(
  promise: Promise<{ data: ApiResponse<AdminUserResponse[]> }>,
  page: number,
  size: number,
): Promise<AdminUsersListResult> {
  try {
    const { data } = await promise;
    const meta = asPaginationMeta(
      (data as unknown as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined,
    );
    return {
      items: Array.isArray(data.data) ? data.data : [],
      page,
      size,
      totalElements: meta?.totalElements ?? (Array.isArray(data.data) ? data.data.length : 0),
      totalPages: meta?.totalPages ?? 1,
    };
  } catch (err) {
    throw new Error(parseApiErrorMessage(err, 'Không tải được danh sách nhân viên nội bộ'));
  }
}

// ─── Avatar upload ─────────────────────────────────────────────────────────────

/**
 * Upload file ảnh lên `/admin/document/upload` (không gắn entity).
 * Trả về URL của document đầu tiên hoặc null nếu lỗi.
 */
async function uploadAvatarFile(file: File, signal?: AbortSignal): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append('files', file);
    const { data } = await axiosInstance.post<ApiResponse<{ filePath?: string; url?: string; fileUrl?: string; path?: string }[]>>(
      API_ENDPOINTS.ADMIN.DOCUMENT_UPLOAD,
      fd,
      { signal, timeout: 60_000 },
    );
    const first = Array.isArray(data.data) ? data.data[0] : null;
    if (!first) return null;
    return (first as Record<string, unknown>).filePath as string
      ?? (first as Record<string, unknown>).url as string
      ?? (first as Record<string, unknown>).fileUrl as string
      ?? (first as Record<string, unknown>).path as string
      ?? null;
  } catch {
    // Upload ảnh không bắt buộc — bỏ qua lỗi, tiếp tục tạo user
    return null;
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const adminInternalStaffService = {
  // ── Utilities ──────────────────────────────────────────────────────────────
  generateSapCode,
  deriveUsername,
  deriveDefaultPassword,

  // ── List ───────────────────────────────────────────────────────────────────
  async listPaged(page: number, size: number, signal?: AbortSignal): Promise<AdminUsersListResult> {
    return parsePagedList(
      axiosInstance.get<ApiResponse<AdminUserResponse[]>>(API_ENDPOINTS.ADMIN.STAFF, {
        params: { page, size },
        signal,
      }),
      page,
      size,
    );
  },

  // ── Get by ID ──────────────────────────────────────────────────────────────
  async getById(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    try {
      const { data } = await axiosInstance.get<ApiResponse<AdminUserResponse>>(
        API_ENDPOINTS.ADMIN.STAFF_BY_ID(id),
        { signal },
      );
      if (data.success === false || data.data == null) {
        throw new Error(data.message?.trim() || 'Không tìm thấy nhân viên');
      }
      return data.data;
    } catch (err) {
      throw new Error(parseApiErrorMessage(err, 'Không tải được thông tin nhân viên'));
    }
  },

  // ── Create ─────────────────────────────────────────────────────────────────
  /**
   * Tạo nhân viên nội bộ mới.
   * - Tự sinh username = `nv` + 6 số cuối sapCode
   * - Mật khẩu mặc định = 6 số cuối sapCode
   * - Mã SAP lưu vào `info01`
   * - Upload ảnh đại diện nếu có file
   */
  async create(payload: CreateInternalStaffPayload): Promise<AdminUserResponse & { sapCode: string; defaultPassword: string }> {
    const { fullName, email, phoneNumber, sapCode, username: customUsername, avatarFile, status, roleId, signal } = payload;

    if (!fullName?.trim()) throw new Error('Họ và tên là bắt buộc.');
    if (!email?.trim()) throw new Error('Email là bắt buộc.');
    if (!phoneNumber?.trim()) throw new Error('Số điện thoại là bắt buộc.');
    if (!sapCode?.trim()) throw new Error('Mã SAP là bắt buộc.');

    // Dùng username tuỳ chỉnh nếu có, ngược lại tự sinh từ SAP
    const username = customUsername?.trim() ? customUsername.trim() : deriveUsername(sapCode);
    const password = deriveDefaultPassword(sapCode);

    // Upload ảnh nếu có
    let avatarUrl: string | null = null;
    if (avatarFile) {
      avatarUrl = await uploadAvatarFile(avatarFile, signal);
    }

    try {
      const body: Record<string, unknown> = {
        username,
        password,
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        fullName: fullName.trim(),
        info01: sapCode.trim(),         // Lưu mã SAP vào info01
        status: status ?? 1,
      };
      if (avatarUrl) body.avatar = avatarUrl;
      if (roleId != null) body.roleId = roleId;

      const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(
        API_ENDPOINTS.ADMIN.STAFF,
        body,
        { signal },
      );

      if (data.success === false || data.data == null) {
        const errMsg = data.errors?.[0]?.message ?? data.message;
        throw new Error(errMsg?.trim() || 'Tạo nhân viên nội bộ thất bại');
      }

      return {
        ...data.data,
        sapCode,
        defaultPassword: password,
      };
    } catch (err) {
      throw new Error(parseApiErrorMessage(err, 'Tạo nhân viên nội bộ thất bại'));
    }
  },

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(payload: UpdateInternalStaffPayload): Promise<AdminUserResponse> {
    const { id, fullName, email, phoneNumber, avatarFile, avatarUrl, status, roleId, password, signal } = payload;

    // Upload ảnh mới nếu có
    let resolvedAvatarUrl: string | null | undefined = avatarUrl;
    if (avatarFile) {
      resolvedAvatarUrl = await uploadAvatarFile(avatarFile, signal);
    }

    const body: StaffEmployeeModUserInfoRequest = { id };
    if (fullName != null) body.fullName = fullName.trim();
    if (email != null) body.email = email.trim();
    if (phoneNumber != null) body.phoneNumber = phoneNumber.trim();
    if (resolvedAvatarUrl != null) body.avatar = resolvedAvatarUrl;
    if (status != null) body.status = status;
    if (roleId != null) body.roleId = roleId;
    if (password?.trim()) body.password = password.trim();

    try {
      const { data } = await axiosInstance.put<ApiResponse<AdminUserResponse>>(
        API_ENDPOINTS.ADMIN.STAFF_BY_ID(id),
        body,
        { signal },
      );
      if (data.success === false || data.data == null) {
        const errMsg = data.errors?.[0]?.message ?? data.message;
        throw new Error(errMsg?.trim() || 'Cập nhật thất bại');
      }
      return data.data;
    } catch (err) {
      throw new Error(parseApiErrorMessage(err, 'Cập nhật nhân viên nội bộ thất bại'));
    }
  },

  // ── Reset password ─────────────────────────────────────────────────────────
  async resetPassword(id: number | string, signal?: AbortSignal): Promise<AdminUserResponse> {
    try {
      const { data } = await axiosInstance.post<ApiResponse<AdminUserResponse>>(
        API_ENDPOINTS.ADMIN.STAFF_RESET_PASSWORD(id),
        {},
        { signal },
      );
      if (data.success === false || data.data == null) {
        throw new Error(data.message?.trim() || 'Đặt lại mật khẩu thất bại');
      }
      return data.data;
    } catch (err) {
      throw new Error(parseApiErrorMessage(err, 'Đặt lại mật khẩu thất bại'));
    }
  },

  // ── Delete ─────────────────────────────────────────────────────────────────
  async delete(id: number | string, signal?: AbortSignal): Promise<void> {
    try {
      await axiosInstance.delete(API_ENDPOINTS.ADMIN.STAFF_BY_ID(id), { signal });
    } catch (err) {
      throw new Error(parseApiErrorMessage(err, 'Xóa nhân viên nội bộ thất bại'));
    }
  },

  // ── Import bằng Excel/CSV/TXT ────────────────────────────────────────────────
  /** Import/upsert nhân viên nội bộ từ file. Không xóa, không đổi mật khẩu khi cập nhật. */
  async importStaff(file: File, signal?: AbortSignal): Promise<CatalogImportResponse> {
    return postImportFile(API_ENDPOINTS.ADMIN.STAFF_IMPORT, file, 'Nhập nhân viên nội bộ thất bại', signal);
  },

  /** Tải file Excel mẫu import nhân viên. */
  async downloadImportTemplate(signal?: AbortSignal): Promise<Blob> {
    return downloadTemplateBlob(API_ENDPOINTS.ADMIN.STAFF_IMPORT_TEMPLATE, signal);
  },
};

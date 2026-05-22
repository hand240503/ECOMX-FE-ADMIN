import { axiosInstance } from '../config/axiosConfig';
import { API_ENDPOINTS } from '../config/apiEndpoints';
import type { ApiResponse } from '../types/common.types';
import type { AdminDocumentRecord } from '../types/product.types';

export const adminDocumentService = {
  /**
   * `POST /admin/document/upload` — multipart `files` (bắt buộc).
   *
   * **Cặp entity (DOC_LOGIC):** hoặc gửi **đủ** `entityId` + `entityType`, hoặc **không** gửi.
   * Chỉ một trong hai → BE trả 400.
   */
  async upload(
    files: File[],
    options?: {
      entityId?: number;
      entityType?: number;
      /** 0-based; file tại index phải là ảnh (sau upload type === 1). Video/PDF → BE 400. */
      mainFileIndex?: number;
      signal?: AbortSignal;
    }
  ): Promise<{ documents: AdminDocumentRecord[]; totalFiles: number | null }> {
    if (files.length === 0) {
      return { documents: [], totalFiles: 0 };
    }

    const entityId = options?.entityId;
    const entityType = options?.entityType;
    const hasId = entityId != null && Number.isFinite(entityId);
    const hasType = entityType != null && Number.isFinite(entityType);
    if (hasId !== hasType) {
      throw new Error(
        'entityId và entityType phải được gửi cùng nhau, hoặc bỏ cả hai (theo DOC_LOGIC backend).'
      );
    }

    const fd = new FormData();
    for (const f of files) {
      fd.append('files', f);
    }
    if (hasId && hasType) {
      fd.append('entityId', String(entityId));
      fd.append('entityType', String(entityType));
    }

    const mainIdx = options?.mainFileIndex;
    if (mainIdx !== undefined && Number.isFinite(mainIdx) && mainIdx >= 0) {
      fd.append('mainFileIndex', String(Math.floor(mainIdx)));
    }

    const { data } = await axiosInstance.post<ApiResponse<AdminDocumentRecord[]>>(
      API_ENDPOINTS.ADMIN.DOCUMENT_UPLOAD,
      fd,
      {
        signal: options?.signal,
        timeout: 120_000,
      }
    );

    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Upload thất bại'
      );
    }

    const docs = Array.isArray(data.data) ? data.data : [];
    const tf = data.metadata?.totalFiles;
    const totalFiles = typeof tf === 'number' ? tf : docs.length;
    return { documents: docs, totalFiles };
  },

  /**
   * `POST /admin/document/{id}/main` — bản ghi phải là ảnh; các document khác cùng entity bị gỡ `isMain`.
   */
  async setMainDocument(documentId: number, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.post<ApiResponse<AdminDocumentRecord>>(
      API_ENDPOINTS.ADMIN.DOCUMENT_SET_MAIN(documentId),
      {},
      { signal }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(
        typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Không đặt được ảnh đại diện'
      );
    }
  },

  /**
   * `PUT /admin/document/{id}/replace` — multipart `file` (một ảnh mới).
   * Server thay file trên Cloudinary và cập nhật metadata; giữ `id`, entity, `isMain`.
   * @see docs/DOCUMENT_MEDIA_API_FE.md §4
   */
  async replaceFile(documentId: number, file: File, signal?: AbortSignal): Promise<AdminDocumentRecord> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await axiosInstance.put<ApiResponse<AdminDocumentRecord>>(
      API_ENDPOINTS.ADMIN.DOCUMENT_REPLACE(documentId),
      fd,
      {
        signal,
        timeout: 120_000,
      }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Thay ảnh thất bại');
    }
    const rec = data.data;
    if (rec == null || typeof rec !== 'object') {
      throw new Error('Thay ảnh thất bại');
    }
    return rec;
  },

  /**
   * `DELETE /admin/document/{id}` — gỡ bản ghi và file trên storage (theo BE).
   * @see docs/DOCUMENT_MEDIA_API_FE.md §3
   */
  async remove(documentId: number, signal?: AbortSignal): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(
      API_ENDPOINTS.ADMIN.DOCUMENT_BY_ID(documentId),
      { signal }
    );
    if (data.success === false) {
      const errMsg = data.errors?.[0]?.message ?? data.message;
      throw new Error(typeof errMsg === 'string' && errMsg.trim() !== '' ? errMsg.trim() : 'Xóa file thất bại');
    }
  },
};

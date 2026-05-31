import { axiosInstance } from '../config/axiosConfig';
import type { ApiResponse } from '../types/common.types';
import type {
  KanbanBoardResponse, TaskResponse, TaskCommentResponse,
  TaskActivityLogResponse, TaskAttachmentResponse, TaskNotificationResponse,
  DashboardStats,
  CreateTaskRequest, UpdateTaskRequest, MoveTaskRequest,
  AddCommentRequest, AddChecklistRequest,
} from '../types/task.types';

const BASE = '/admin/tasks';

export const adminTaskService = {

  // ── Board ──────────────────────────────────────────────────────────────────

  async getDefaultBoard(signal?: AbortSignal): Promise<KanbanBoardResponse> {
    const { data } = await axiosInstance.get<ApiResponse<KanbanBoardResponse>>(
      `${BASE}/board/default`, { signal }
    );
    if (!data.success || !data.data) throw new Error(data.message ?? 'Không tải được board');
    return data.data;
  },

  async getKanbanBoard(boardId: number, signal?: AbortSignal): Promise<KanbanBoardResponse> {
    const { data } = await axiosInstance.get<ApiResponse<KanbanBoardResponse>>(
      `${BASE}/board/${boardId}`, { signal }
    );
    return data.data!;
  },

  async getDashboardStats(boardId: number, signal?: AbortSignal): Promise<DashboardStats> {
    const { data } = await axiosInstance.get<ApiResponse<DashboardStats>>(
      `${BASE}/board/${boardId}/stats`, { signal }
    );
    return data.data!;
  },

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  async createTask(request: CreateTaskRequest, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.post<ApiResponse<TaskResponse>>(BASE, request, { signal });
    if (!data.success || !data.data) throw new Error(data.message ?? 'Tạo task thất bại');
    return data.data;
  },

  async getTask(taskId: number, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.get<ApiResponse<TaskResponse>>(`${BASE}/${taskId}`, { signal });
    return data.data!;
  },

  async updateTask(taskId: number, request: UpdateTaskRequest, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.put<ApiResponse<TaskResponse>>(
      `${BASE}/${taskId}`, request, { signal }
    );
    if (!data.success || !data.data) throw new Error(data.message ?? 'Cập nhật thất bại');
    return data.data;
  },

  async deleteTask(taskId: number, signal?: AbortSignal): Promise<void> {
    await axiosInstance.delete(`${BASE}/${taskId}`, { signal });
  },

  // ── Kanban ─────────────────────────────────────────────────────────────────

  async moveTask(taskId: number, request: MoveTaskRequest, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.patch<ApiResponse<TaskResponse>>(
      `${BASE}/${taskId}/move`, request, { signal }
    );
    if (!data.success || !data.data) throw new Error(data.message ?? 'Di chuyển thất bại');
    return data.data;
  },

  async assignTask(taskId: number, userId: number, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.patch<ApiResponse<TaskResponse>>(
      `${BASE}/${taskId}/assign/${userId}`, {}, { signal }
    );
    return data.data!;
  },

  // ── Comments ───────────────────────────────────────────────────────────────

  async addComment(taskId: number, request: AddCommentRequest, signal?: AbortSignal): Promise<TaskCommentResponse> {
    const { data } = await axiosInstance.post<ApiResponse<TaskCommentResponse>>(
      `${BASE}/${taskId}/comments`, request, { signal }
    );
    return data.data!;
  },

  async getComments(taskId: number, page = 0, size = 20, signal?: AbortSignal): Promise<TaskCommentResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<{ content: TaskCommentResponse[] }>>(
      `${BASE}/${taskId}/comments`, { params: { page, size }, signal }
    );
    return data.data?.content ?? [];
  },

  async deleteComment(commentId: number, signal?: AbortSignal): Promise<void> {
    await axiosInstance.delete(`${BASE}/comments/${commentId}`, { signal });
  },

  // ── Checklist ──────────────────────────────────────────────────────────────

  async addChecklist(taskId: number, request: AddChecklistRequest, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.post<ApiResponse<TaskResponse>>(
      `${BASE}/${taskId}/checklists`, request, { signal }
    );
    return data.data!;
  },

  async toggleChecklistItem(itemId: number, signal?: AbortSignal): Promise<TaskResponse> {
    const { data } = await axiosInstance.patch<ApiResponse<TaskResponse>>(
      `${BASE}/checklist-items/${itemId}/toggle`, {}, { signal }
    );
    return data.data!;
  },

  // ── Activity ───────────────────────────────────────────────────────────────

  async getActivityLog(taskId: number, page = 0, size = 20, signal?: AbortSignal): Promise<TaskActivityLogResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<{ content: TaskActivityLogResponse[] }>>(
      `${BASE}/${taskId}/activity`, { params: { page, size }, signal }
    );
    return data.data?.content ?? [];
  },

  // ── Attachments ────────────────────────────────────────────────────────────

  async uploadAttachment(taskId: number, file: File, commentId?: number, signal?: AbortSignal): Promise<TaskAttachmentResponse> {
    const fd = new FormData();
    fd.append('file', file);
    if (commentId != null) fd.append('commentId', String(commentId));
    const { data } = await axiosInstance.post<ApiResponse<TaskAttachmentResponse>>(
      `${BASE}/${taskId}/attachments`, fd, { signal, timeout: 60_000 }
    );
    if (!data.success || !data.data) throw new Error(data.message ?? 'Upload thất bại');
    return data.data;
  },

  async getAttachments(taskId: number, signal?: AbortSignal): Promise<TaskAttachmentResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<TaskAttachmentResponse[]>>(
      `${BASE}/${taskId}/attachments`, { signal }
    );
    return data.data ?? [];
  },

  async deleteAttachment(attachmentId: number, signal?: AbortSignal): Promise<void> {
    await axiosInstance.delete(`${BASE}/attachments/${attachmentId}`, { signal });
  },

  // ── Notifications ──────────────────────────────────────────────────────────

  async getUnreadCount(signal?: AbortSignal): Promise<number> {
    const { data } = await axiosInstance.get<ApiResponse<number>>(
      `${BASE}/notifications/unread-count`, { signal }
    );
    return data.data ?? 0;
  },

  async getUnreadNotifications(page = 0, size = 10, signal?: AbortSignal): Promise<TaskNotificationResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<{ content: TaskNotificationResponse[] }>>(
      `${BASE}/notifications/unread`, { params: { page, size }, signal }
    );
    return data.data?.content ?? [];
  },

  async getAllNotifications(page = 0, size = 15, signal?: AbortSignal): Promise<TaskNotificationResponse[]> {
    const { data } = await axiosInstance.get<ApiResponse<{ content: TaskNotificationResponse[] }>>(
      `${BASE}/notifications`, { params: { page, size }, signal }
    );
    return data.data?.content ?? [];
  },

  async markNotificationRead(id: number, signal?: AbortSignal): Promise<void> {
    await axiosInstance.patch(`${BASE}/notifications/${id}/read`, {}, { signal });
  },

  async markAllNotificationsRead(signal?: AbortSignal): Promise<void> {
    await axiosInstance.patch(`${BASE}/notifications/read-all`, {}, { signal });
  },

  async deleteNotification(id: number, signal?: AbortSignal): Promise<void> {
    await axiosInstance.delete(`${BASE}/notifications/${id}`, { signal });
  },

  async deleteAllNotifications(signal?: AbortSignal): Promise<void> {
    await axiosInstance.delete(`${BASE}/notifications/all`, { signal });
  },
};

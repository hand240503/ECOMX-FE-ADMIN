import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Search, Filter, Calendar, MessageSquare,
  Paperclip, Users, AlertCircle, CheckCircle2, Loader2,
  ListTodo, LayoutGrid, CalendarDays, GanttChart,
  Package, RefreshCw, DollarSign, Flame, Gift,
  CalendarCheck, Megaphone, SlidersHorizontal, ChevronDown,
  CheckSquare, Upload, FileText, Trash2, AtSign, Send,
  History, ExternalLink, AlertTriangle,
  Clock, ListChecks, Zap,
  CircleCheck, Ban, UserCheck, ThumbsUp,
  Pencil, Save, XCircle,
} from 'lucide-react';
import { adminTaskService } from '../../api/services/adminTaskService';
import { adminInternalStaffService } from '../../api/services/adminInternalStaffService';
import { adminDepartmentService } from '../../api/services/adminDepartmentService';
import type { AdminUserResponse } from '../../api/types/adminAccessControl.types';
import type {
  TaskResponse, TaskStatus, TaskPriority, TaskType,
  TaskCommentResponse, TaskAttachmentResponse, TaskActivityLogResponse,
  AddCommentRequest,
} from '../../api/types/task.types';
import { notify } from '../../utils/notify';
import { useAuth } from '../../app/auth/AuthProvider';

// ─── CSS-in-JS style block ─────────────────────────────────────────────────────
// We inject a <style> tag once via a module-level constant
const STYLES = `
  .tm-page { --accent: #E30019; --accent-dim: rgba(227,0,25,.08); }
  .tm-kanban::-webkit-scrollbar { height: 5px; }
  .tm-kanban::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
  .tm-kbody::-webkit-scrollbar { width: 3px; }
  .tm-kbody::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 2px; }
  .tm-drawer-body::-webkit-scrollbar { width: 4px; }
  .tm-drawer-body::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 2px; }
  .tm-tcard { border-left-width: 3px; transition: box-shadow .15s, transform .15s; }
  .tm-tcard:hover { box-shadow: 0 6px 20px rgba(0,0,0,.1); transform: translateY(-1px); }
  .tm-kpi { transition: box-shadow .15s, transform .15s; }
  .tm-kpi:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-1px); }
  .tm-vtab { transition: background .12s, color .12s; }
  .tm-sb-item { transition: background .12s, color .12s; }
  .tm-add-btn { transition: border-color .12s, color .12s; }
  .tm-add-btn:hover { border-color: #E30019; color: #E30019; }
  .tm-overdue { color: #BE123C !important; font-weight: 600; }
  .tm-col-drop { transition: background .12s, border-color .12s, transform .12s; }
  .tm-col-drop.drag-over { background: rgba(124,58,237,.05) !important; border-color: #7C3AED !important; transform: scaleY(1.01); }
  .tm-col-drop.drag-over-invalid { background: rgba(239,68,68,.04) !important; }
  [draggable=true] { user-select: none; }
`;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BOARD_ID = 1;

const TYPE_CFG: Record<TaskType, { label: string; icon: React.ReactNode; bg: string; color: string; short: string }> = {
  ORDER_PREPARATION: { label: 'Chuẩn bị đơn',  short: 'ĐƠN HÀNG', icon: <Package     size={10} />, bg: '#EFF6FF', color: '#1D4ED8' },
  RETURN_PROCESSING: { label: 'Trả hàng',       short: 'TRẢ HÀNG', icon: <RefreshCw   size={10} />, bg: '#FFF7ED', color: '#C2410C' },
  PRICE_UPDATE:      { label: 'Cập nhật giá',   short: 'GIÁ',      icon: <DollarSign  size={10} />, bg: '#F0FDF4', color: '#15803D' },
  PROMOTION_SETUP:   { label: 'Khuyến mãi',     short: 'KM',       icon: <Flame       size={10} />, bg: '#FFF1F2', color: '#BE123C' },
  MEETING:           { label: 'Họp',            short: 'HỌP',      icon: <CalendarCheck size={10}/>, bg: '#F0F9FF', color: '#0369A1' },
  INVENTORY_CHECK:   { label: 'Mua kèm (PwP)',  short: 'PwP',      icon: <Gift        size={10} />, bg: '#FAF5FF', color: '#6D28D9' },
  OTHER:             { label: 'Marketing',      short: 'MARKET',   icon: <Megaphone   size={10} />, bg: '#FEFCE8', color: '#92400E' },
};

const PRIORITY_CFG: Record<TaskPriority, { label: string; dot: string; bg: string; color: string; border: string }> = {
  URGENT: { label: 'Khẩn cấp',   dot: '#E30019', bg: '#FFF1F2', color: '#BE123C', border: '#E30019' },
  HIGH:   { label: 'Cao',        dot: '#F97316', bg: '#FFF7ED', color: '#C2410C', border: '#F97316' },
  MEDIUM: { label: 'Trung bình', dot: '#EAB308', bg: '#FEFCE8', color: '#92400E', border: '#EAB308' },
  LOW:    { label: 'Thấp',       dot: '#22C55E', bg: '#F0FDF4', color: '#15803D', border: '#22C55E' },
};

const PRIORITY_EMOJI: Record<TaskPriority, string> = {
  URGENT: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢',
};

const COLUMNS: {
  key: TaskStatus; label: string;
  hBg: string; hBorder: string; hColor: string;
  dot: string; cntBg: string; cntColor: string;
}[] = [
  { key: 'NEW',         label: 'Mới',         hBg: '#EFF6FF', hBorder: '#BFDBFE', hColor: '#1D4ED8', dot: '#3B82F6', cntBg: '#DBEAFE', cntColor: '#1E40AF' },
  { key: 'ASSIGNED',    label: 'Đã giao',     hBg: '#F8FAFC', hBorder: '#E2E8F0', hColor: '#374151', dot: '#6B7280', cntBg: '#F1F5F9', cntColor: '#374151' },
  { key: 'IN_PROGRESS', label: 'Đang làm',    hBg: '#FFF7ED', hBorder: '#FED7AA', hColor: '#C2410C', dot: '#F97316', cntBg: '#FFEDD5', cntColor: '#C2410C' },
  { key: 'REVIEW',      label: 'Đang duyệt',  hBg: '#FEFCE8', hBorder: '#FDE68A', hColor: '#92400E', dot: '#EAB308', cntBg: '#FEF9C3', cntColor: '#92400E' },
  { key: 'DONE',        label: 'Hoàn thành',  hBg: '#F0FDF4', hBorder: '#BBF7D0', hColor: '#15803D', dot: '#22C55E', cntBg: '#DCFCE7', cntColor: '#15803D' },
  { key: 'CANCELLED',   label: 'Đã hủy',      hBg: '#FFF1F2', hBorder: '#FECDD3', hColor: '#BE123C', dot: '#F43F5E', cntBg: '#FFE4E6', cntColor: '#BE123C' },
];

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  STATUS_CHANGED:   <RefreshCw size={10} />,
  COMMENTED:        <MessageSquare size={10} />,
  ASSIGNED:         <Users size={10} />,
  CREATED:          <Plus size={10} />,
  ATTACHMENT_ADDED: <Paperclip size={10} />,
  TITLE_UPDATED:    <CheckSquare size={10} />,
  PRIORITY_CHANGED: <AlertTriangle size={10} />,
};



// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(id?: number | null): string {
  const colors = ['#E30019','#3B82F6','#8B5CF6','#0369A1','#15803D','#C2410C','#6D28D9','#DC2626'];
  return colors[(id ?? 0) % colors.length];
}

function getInitials(name?: string | null, username?: string | null): string {
  const src = name ?? username ?? '?';
  return src.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); }
  catch { return iso; }
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

function isOverdue(dueDate?: string | null, status?: TaskStatus): boolean {
  if (!dueDate || status === 'DONE' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
}

// ─── Style injector ───────────────────────────────────────────────────────────

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ─── Small components ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TaskType }) {
  const c = TYPE_CFG[type] ?? TYPE_CFG.OTHER;
  return (
    <span style={{ background: c.bg, color: c.color }}
      className="inline-flex items-center gap-[3px] rounded-[5px] px-[7px] py-[2px] text-[10px] font-bold tracking-wide">
      {c.icon} {c.short}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const p = PRIORITY_CFG[priority] ?? PRIORITY_CFG.MEDIUM;
  return (
    <span style={{ background: p.bg, color: p.color }}
      className="inline-flex items-center gap-[3px] rounded-[5px] px-[6px] py-[2px] text-[10px] font-bold">
      <span style={{ background: p.dot }} className="inline-block h-[5px] w-[5px] rounded-full flex-shrink-0" />
      {p.label}
    </span>
  );
}

function UserAvatar({ name, username, id, size = 22 }: { name?: string | null; username?: string | null; id?: number | null; size?: number }) {
  return (
    <span style={{ background: avatarColor(id), width: size, height: size, fontSize: size * 0.42 }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white">
      {getInitials(name, username)}
    </span>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, onClick, onDragStart, onDragEnd, isDragging,
}: {
  task: TaskResponse;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}) {
  const p = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.MEDIUM;
  const overdue = isOverdue(task.dueDate, task.status);
  const isDone = task.status === 'DONE' || task.status === 'CANCELLED';
  const pct = task.checklistSummary ? task.checklistSummary.percentage : null;

  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        borderLeftColor: p.border,
        opacity: isDragging ? 0.35 : isDone ? 0.65 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: isDragging ? 'rotate(1.5deg) scale(1.02)' : undefined,
        transition: 'opacity .15s, transform .15s',
      }}
      className="tm-tcard group rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-[11px_12px] shadow-sm"
    >
      {/* Top row: ID + type badge */}
      <div className="mb-[5px] flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold text-[var(--text-muted)]">#{task.id}</span>
        <TypeBadge type={task.taskType} />
      </div>

      {/* Title */}
      <p className="mb-[7px] line-clamp-2 text-[12.5px] font-semibold leading-snug text-[var(--text-primary)]">
        {task.title}
      </p>

      {/* Priority badge */}
      <div className="mb-[7px]">
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Checklist progress */}
      {task.checklistSummary && task.checklistSummary.total > 0 && (
        <div className="mb-[7px]">
          <div className="mb-1 flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>Tiến độ</span>
            <span className="font-medium">{task.checklistSummary.done}/{task.checklistSummary.total}</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-[var(--bg-border)]">
            <div style={{ width: `${pct}%`, background: p.border }} className="h-full rounded-full transition-all" />
          </div>
        </div>
      )}

      {/* Footer: assignee + meta */}
      <div className="flex items-center justify-between">
        {task.assignee ? (
          <UserAvatar name={task.assignee.fullName} username={task.assignee.username} id={task.assignee.id} size={20} />
        ) : (
          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-dashed border-[var(--bg-border)] text-[9px] text-[var(--text-muted)]">?</span>
        )}
        <div className="flex items-center gap-[6px] text-[10.5px] text-[var(--text-muted)]">
          <span className={`flex items-center gap-[2px] ${overdue ? 'tm-overdue' : ''}`}>
            {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
            {formatDate(task.dueDate)}
          </span>
          {task.commentCount > 0 && (
            <span className="flex items-center gap-[2px]"><MessageSquare size={10} /> {task.commentCount}</span>
          )}
          {task.attachmentCount > 0 && (
            <span className="flex items-center gap-[2px]"><Paperclip size={10} /> {task.attachmentCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Drawer ──────────────────────────────────────────────────────────────

type DrawerTab = 'detail' | 'comments' | 'files' | 'activity';

function TaskDrawer({ taskId, departments, onClose }: { taskId: number | null; departments: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const open = taskId !== null;
  const [activeTab, setActiveTab]     = useState<DrawerTab>('detail');
  const [commentText, setCommentText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<{ active: boolean; text: string; index: number; caretPos: number } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Edit mode state ──
  const [editMode, setEditMode]       = useState(false);
  const [editTitle, setEditTitle]     = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editType, setEditType]       = useState<TaskType>('OTHER');
  const [editDeptId, setEditDeptId]     = useState<number | null>(null);
  const [editAssigneeId, setEditAssigneeId] = useState<number | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  
  const { user } = useAuth();
  
  // ── Staff list ──
  const { data: staffResult } = useQuery({
    queryKey: ['staff-list-assignee'],
    queryFn: () => adminInternalStaffService.listPaged(0, 200),
    staleTime: 60_000,
    enabled: open,
  });
  const allStaff = (staffResult?.items ?? []).filter(u => !u.roles?.includes('ROLE_CUSTOMER'));

  // ── Delete confirm state ──
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: ({ signal }) => adminTaskService.getTask(taskId!, signal),
    enabled: open && taskId != null,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: ({ signal }) => adminTaskService.getComments(taskId!, 0, 20, signal),
    enabled: open && taskId != null && activeTab === 'comments',
  });

  const { data: attachments = [], isLoading: filesLoading } = useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: ({ signal }) => adminTaskService.getAttachments(taskId!, signal),
    enabled: open && taskId != null && activeTab === 'files',
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: ({ signal }) => adminTaskService.getActivityLog(taskId!, 0, 30, signal),
    enabled: open && taskId != null && activeTab === 'activity',
  });

  // Populate edit fields when task loads
  useEffect(() => {
    if (task && !editMode) {
      setEditTitle(task.title);
      setEditDesc(task.description ?? '');
      setEditPriority(task.priority);
      setEditType(task.taskType);
      setEditDeptId(task.departmentId ?? null);
      setEditAssigneeId(task.assignee?.id ?? null);
      setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    }
  }, [task, editMode]);

  // Reset edit mode when drawer closes / different task opens
  useEffect(() => {
    if (!open) { setEditMode(false); setDeleteConfirm(false); }
  }, [open, taskId]);

  const addCommentMut = useMutation({
    mutationFn: (req: AddCommentRequest) => adminTaskService.addComment(taskId!, req),
    onSuccess: () => {
      setCommentText('');
      void qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
    },
    onError: () => notify.error('Gửi bình luận thất bại'),
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: number) => adminTaskService.deleteComment(commentId),
    onSuccess: () => {
      notify.success('Đã xóa bình luận');
      void qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
    },
    onError: (err: any) => notify.error(err.response?.data?.message || 'Xóa bình luận thất bại'),
  });

  const handleDeleteComment = (commentId: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      deleteCommentMut.mutate(commentId);
    }
  };

  const deleteAttachMut = useMutation({
    mutationFn: (attachmentId: number) => adminTaskService.deleteAttachment(attachmentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['task-attachments', taskId] }),
    onError: () => notify.error('Xóa file thất bại'),
  });

  const completeMut = useMutation({
    mutationFn: () => adminTaskService.moveTask(taskId!, { targetStatus: 'DONE', targetPosition: 0 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
      notify.success('Đã hoàn thành task');
    },
  });

  // ── Update task mutation ──
  const updateMut = useMutation({
    mutationFn: () => adminTaskService.updateTask(taskId!, {
      title: editTitle.trim() || undefined,
      description: editDesc.trim() || undefined,
      priority: editPriority,
      taskType: editType,
      departmentId: editDeptId,
      assigneeId: editAssigneeId ?? undefined,
      dueDate: editDueDate || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
      setEditMode(false);
      notify.success('Đã cập nhật task');
    },
    onError: () => notify.error('Cập nhật thất bại'),
  });

  // ── Delete task mutation ──
  const deleteMut = useMutation({
    mutationFn: () => adminTaskService.deleteTask(taskId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
      notify.success('Đã xóa task');
      onClose();
    },
    onError: () => notify.error('Xóa task thất bại'),
  });

  // ── Cancel task (move to CANCELLED) ──
  const cancelMut = useMutation({
    mutationFn: () => adminTaskService.moveTask(taskId!, { targetStatus: 'CANCELLED', targetPosition: 0 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
      notify.success('Task đã bị huỷ');
    },
    onError: () => notify.error('Huỷ task thất bại'),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId) return;
    setUploadingFile(true);
    try {
      await adminTaskService.uploadAttachment(taskId, file);
      void qc.invalidateQueries({ queryKey: ['task-attachments', taskId] });
      void qc.invalidateQueries({ queryKey: ['task-detail', taskId] });
      notify.success('Upload thành công');
    } catch {
      notify.error('Upload thất bại');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendComment = () => {
    if (!commentText.trim()) return;
    addCommentMut.mutate({ content: commentText.trim() });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);
    const caretPos = e.target.selectionStart || 0;
    const textBeforeCaret = val.slice(0, caretPos);
    
    const match = textBeforeCaret.match(/@([\w.-]*)$/);
    if (match) {
      setMentionQuery({ active: true, text: match[1].toLowerCase(), index: 0, caretPos: caretPos - match[0].length });
    } else {
      setMentionQuery(null);
    }
  };

  const filteredStaff = mentionQuery
    ? allStaff.filter(s => (
        s.id !== user?.id && 
        s.id !== user?.userInfo?.id && 
        (s.username?.toLowerCase().includes(mentionQuery.text) || s.fullName?.toLowerCase().includes(mentionQuery.text))
      )).slice(0, 5)
    : [];

  const handleMentionSelect = (staff: AdminUserResponse) => {
    if (!mentionQuery) return;
    const val = commentText;
    const before = val.slice(0, mentionQuery.caretPos);
    const after = val.slice(mentionQuery.caretPos + mentionQuery.text.length + 1);
    setCommentText(`${before}@${staff.username} ${after}`);
    setMentionQuery(null);
    commentInputRef.current?.focus();
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery && filteredStaff.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionQuery(prev => prev ? { ...prev, index: (prev.index + 1) % filteredStaff.length } : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionQuery(prev => prev ? { ...prev, index: (prev.index - 1 + filteredStaff.length) % filteredStaff.length } : null);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMentionSelect(filteredStaff[mentionQuery.index]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendComment();
    }
  };

  const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { key: 'detail',   label: 'Chi tiết',  icon: <ListChecks size={12} /> },
    { key: 'comments', label: `Bình luận${task ? ` (${task.commentCount})` : ''}`, icon: <MessageSquare size={12} /> },
    { key: 'files',    label: `Tệp${task ? ` (${task.attachmentCount})` : ''}`,   icon: <Paperclip size={12} /> },
    { key: 'activity', label: 'Lịch sử',   icon: <History size={12} /> },
  ];

  const p = task ? (PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.MEDIUM) : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        className="fixed inset-0 z-[200] bg-black/25 backdrop-blur-[1px] transition-opacity duration-200"
      />

      {/* Drawer panel */}
      <div
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          width: 480,
          boxShadow: '-8px 0 40px rgba(0,0,0,.12)',
        }}
        className="fixed bottom-0 right-0 top-0 z-[201] flex flex-col bg-[var(--bg-surface)] transition-transform duration-250"
      >
        {/* ── Drawer Header ── */}
        <div className="flex-shrink-0 border-b border-[var(--bg-border)]">
          {taskLoading ? (
            <div className="flex h-20 items-center gap-2 px-5 text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin" /> Đang tải…
            </div>
          ) : task ? (
            <div className="p-5 pb-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 text-[10.5px] font-semibold text-[var(--text-muted)]">
                    #{task.id} · {task.taskType.replace(/_/g, ' ')} · Operations
                  </div>
                  <h2 className="text-[15px] font-bold leading-snug text-[var(--text-primary)]">{task.title}</h2>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {/* Edit toggle */}
                  {(!task.creator || user?.id === task.creator.id) && (
                  <button
                    onClick={() => { setEditMode(v => !v); setDeleteConfirm(false); }}
                    title={editMode ? 'Hủy chỉnh sửa' : 'Chỉnh sửa task'}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${editMode ? 'border-[#7C3AED] bg-[#7C3AED] text-white' : 'border-[var(--bg-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
                  >
                    <Pencil size={12} />
                  </button>
                  )}
                  <button
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-[5px]">
                <TypeBadge type={task.taskType} />
                <PriorityBadge priority={task.priority} />
                <span className="inline-flex items-center gap-[3px] rounded-[5px] bg-[var(--bg-elevated)] px-[7px] py-[2px] text-[10px] font-semibold text-[var(--text-secondary)]">
                  {task.status.replace('_', ' ')}
                </span>
                {editMode && (
                  <span className="inline-flex items-center gap-[3px] rounded-[5px] bg-[#7C3AED] px-[7px] py-[2px] text-[10px] font-semibold text-white">
                    <Pencil size={9} /> Đang chỉnh sửa
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-16 items-center justify-between gap-3 px-5">
              <span className="text-[13px] text-[var(--text-muted)]">Không tìm thấy task</span>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--bg-border)] text-[var(--text-secondary)]">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-0 border-t border-[var(--bg-border)] px-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-[5px] px-4 py-[10px] text-[11.5px] font-medium transition-colors border-b-2 ${
                  activeTab === t.key
                    ? 'border-[#E30019] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: DETAIL ── */}
        {activeTab === 'detail' && (
          <div className="tm-drawer-body flex-1 overflow-y-auto p-5">
            {task && (
              <div className="space-y-5">

                {/* ── EDIT FORM (editMode=true) ── */}
                {editMode ? (
                  <div className="space-y-3 rounded-xl border-2 border-[#7C3AED]/30 bg-[#7C3AED]/04 p-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#7C3AED]">Chỉnh sửa task</p>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Tiêu đề *</label>
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="h-[36px] w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED] focus:shadow-[0_0_0_3px_rgba(124,58,237,.1)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Mô tả</label>
                      <textarea
                        rows={3}
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="w-full resize-y rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED] focus:shadow-[0_0_0_3px_rgba(124,58,237,.1)] transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Ưu tiên</label>
                        <select
                          value={editPriority}
                          onChange={e => setEditPriority(e.target.value as TaskPriority)}
                          className="h-[34px] w-full cursor-pointer rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED]"
                        >
                          <option value="URGENT">🔴 Critical</option>
                          <option value="HIGH">🟠 High</option>
                          <option value="MEDIUM">🟡 Medium</option>
                          <option value="LOW">🟢 Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Loại task</label>
                        <select
                          value={editType}
                          onChange={e => setEditType(e.target.value as TaskType)}
                          className="h-[34px] w-full cursor-pointer rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED]"
                        >
                          {TASK_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Phân loại</label>
                        <select
                          value={editDeptId ?? -1}
                          onChange={e => setEditDeptId(Number(e.target.value) === -1 ? null : Number(e.target.value))}
                          className="h-[34px] w-full cursor-pointer rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED]"
                        >
                          <option value={-1}>🌍 Chung</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>🏢 {d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Người phụ trách</label>
                        <select
                          value={editAssigneeId ?? -1}
                          onChange={e => setEditAssigneeId(Number(e.target.value) === -1 ? null : Number(e.target.value))}
                          className="h-[34px] w-full cursor-pointer rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED]"
                        >
                          <option value={-1}>— Chưa gán —</option>
                          {allStaff.map(s => (
                            <option key={s.id} value={s.id}>{s.userInfo?.fullName ?? s.username}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Hạn hoàn thành</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          className="h-[34px] w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[#7C3AED]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditMode(false)}
                        className="flex h-[32px] items-center gap-1 rounded-lg border border-[var(--bg-border)] px-3 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <XCircle size={13} /> Hủy
                      </button>
                      <button
                        onClick={() => updateMut.mutate()}
                        disabled={!editTitle.trim() || updateMut.isPending}
                        className="flex h-[32px] items-center gap-1 rounded-lg bg-[#7C3AED] px-4 text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                      >
                        {updateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── READ-ONLY INFO ── */
                  <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Thông tin task</p>
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--bg-elevated)] p-4">
                      {[
                        ['Loại task',   task.taskType.replace(/_/g, ' ')],
                        ['Phân loại',   task.departmentId ? (departments.find(d => d.id === task.departmentId)?.name ?? '—') : 'Chung'],
                        ['Ưu tiên',     `${PRIORITY_EMOJI[task.priority]} ${p?.label}`],
                        ['Trạng thái',  task.status.replace('_', ' ')],
                        ['Hạn xử lý',   isOverdue(task.dueDate, task.status)
                          ? `⚠️ ${formatDate(task.dueDate)}`
                          : formatDate(task.dueDate)],
                      ].map(([lbl, val]) => (
                        <div key={lbl}>
                          <div className="text-[10px] text-[var(--text-muted)]">{lbl}</div>
                          <div className={`text-[12.5px] font-semibold ${lbl === 'Hạn xử lý' && isOverdue(task.dueDate, task.status) ? 'text-[#BE123C]' : 'text-[var(--text-primary)]'}`}>{val}</div>
                        </div>
                      ))}
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">Người tạo</div>
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                          {task.creator && <UserAvatar name={task.creator.fullName} username={task.creator.username} id={task.creator.id} size={16} />}
                          {task.creator?.fullName ?? task.creator?.username ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">Phụ trách</div>
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                          {task.assignee
                            ? <><UserAvatar name={task.assignee.fullName} username={task.assignee.username} id={task.assignee.id} size={16} />{task.assignee.fullName ?? task.assignee.username}</>
                            : <span className="text-[var(--text-muted)]">Chưa gán</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress */}
                {!editMode && task.checklistSummary && task.checklistSummary.total > 0 && (
                  <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Checklist</p>
                    <div className="rounded-xl bg-[var(--bg-elevated)] p-4">
                      <div className="mb-2 flex justify-between text-[12px]">
                        <span className="text-[var(--text-secondary)]">Hoàn thành</span>
                        <span className="font-bold text-[#E30019]">{task.checklistSummary.percentage}%</span>
                      </div>
                      <div className="h-[6px] overflow-hidden rounded-full bg-[var(--bg-border)]">
                        <div className="h-full rounded-full bg-[#E30019]" style={{ width: `${task.checklistSummary.percentage}%` }} />
                      </div>
                      <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                        {task.checklistSummary.done}/{task.checklistSummary.total} mục đã hoàn thành
                      </div>
                    </div>
                  </div>
                )}

                {/* Description (read-only) */}
                {!editMode && task.description && (
                  <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Mô tả</p>
                    <p className="rounded-xl bg-[var(--bg-elevated)] p-4 text-[12.5px] leading-relaxed text-[var(--text-primary)]">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Source link */}
                {task.sourceType && task.sourceId && (
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--bg-border)] p-3 text-[12px]">
                    <Package size={14} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">Nguồn:</span>
                    {task.sourceType === 'ORDER' ? (
                      <Link
                        to={`/admin/orders/${task.sourceId}`}
                        className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                      >
                        ORDER #{task.sourceId}
                        <ExternalLink size={11} />
                      </Link>
                    ) : (
                      <span className="font-semibold text-[var(--text-primary)]">{task.sourceType} #{task.sourceId}</span>
                    )}
                    {task.isAutoGenerated && (
                      <span className="ml-auto rounded-full bg-[var(--bg-elevated)] px-2 py-[1px] text-[10px] text-[var(--text-muted)]">Tự động</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: COMMENTS ── */}
        {activeTab === 'comments' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="tm-drawer-body flex-1 overflow-y-auto p-5">
              {commentsLoading ? (
                <div className="flex items-center gap-2 text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Đang tải…</div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                  Chưa có bình luận
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((c: TaskCommentResponse) => {
                    const isAuthor = c.author.id === user?.id || c.author.id === (user as any)?.userInfo?.id;
                    const hoursSinceCreation = (new Date().getTime() - new Date(c.createdDate).getTime()) / (1000 * 60 * 60);
                    const isAdmin = user?.roles?.some(r => ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(r.toUpperCase())) || false;
                    const canDelete = isAdmin || (isAuthor && hoursSinceCreation <= 24);

                    return (
                      <div key={c.id} className="group flex gap-3">
                        <UserAvatar name={c.author.fullName} username={c.author.username} id={c.author.id} size={28} />
                        <div className="flex-1">
                          <div className="mb-[3px] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                                {c.author.fullName ?? c.author.username}
                              </span>
                              <span className="text-[10.5px] text-[var(--text-muted)]">{timeAgo(c.createdDate)}</span>
                              {c.isEdited && <span className="text-[10px] text-[var(--text-muted)]">(đã sửa)</span>}
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                disabled={deleteCommentMut.isPending}
                                className="opacity-0 transition-opacity hover:text-[#E30019] group-hover:opacity-100 disabled:opacity-50"
                                title="Xóa bình luận"
                              >
                                <Trash2 size={12} className="text-[var(--text-muted)] hover:text-[#E30019] transition-colors" />
                              </button>
                            )}
                          </div>
                          <p className="rounded-[0_10px_10px_10px] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-primary)]">
                            {c.content.split(/(@\w+)/g).map((part, j) =>
                              part.startsWith('@')
                                ? <span key={j} className="font-semibold text-[#E30019]">{part}</span>
                                : part
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 border-t border-[var(--bg-border)] p-4">
              <div className="mb-1.5 flex items-center gap-1 text-[10.5px] text-[var(--text-muted)]">
                <AtSign size={11} /> Gõ <kbd className="rounded bg-[var(--bg-border)] px-1 text-[10px]">@username</kbd> để mention
              </div>
              <div className="relative flex gap-2">
                {mentionQuery && filteredStaff.length > 0 && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg">
                    {filteredStaff.map((staff, idx) => (
                      <div
                        key={staff.id}
                        onClick={() => handleMentionSelect(staff)}
                        className={clsx(
                          'flex cursor-pointer items-center gap-3 border-b border-[var(--bg-border)] px-4 py-2.5 last:border-0 hover:bg-[var(--bg-elevated)]',
                          idx === mentionQuery.index && 'bg-[var(--accent-soft)]'
                        )}
                      >
                        <UserAvatar name={staff.fullName} username={staff.username} id={staff.id} size={24} />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{staff.fullName}</span>
                          <span className="truncate text-[11px] text-[var(--text-muted)]">@{staff.username}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Thêm bình luận…"
                  className="h-[34px] flex-1 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[#E30019]"
                />
                <button
                  onClick={sendComment}
                  disabled={!commentText.trim() || addCommentMut.isPending}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-[#E30019] text-white disabled:opacity-50 hover:opacity-90"
                >
                  {addCommentMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: FILES ── */}
        {activeTab === 'files' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="tm-drawer-body flex-1 overflow-y-auto p-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--bg-border)] p-6 text-center transition-colors hover:border-[#E30019] hover:bg-[rgba(227,0,25,.04)]"
              >
                <Upload size={20} className="text-[var(--text-muted)]" />
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">Nhấn để chọn file hoặc kéo thả</p>
                <p className="text-[10.5px] text-[var(--text-muted)]">PDF, Word, Excel, ảnh · Tối đa 20MB</p>
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-[12px] text-[#E30019]">
                    <Loader2 size={14} className="animate-spin" /> Đang upload…
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

              {filesLoading ? (
                <div className="flex items-center gap-2 text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Đang tải…</div>
              ) : attachments.length === 0 ? (
                <p className="text-center text-[12px] text-[var(--text-muted)]">Chưa có file đính kèm</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((a: TaskAttachmentResponse) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                        <FileText size={16} className="text-[var(--text-muted)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{a.fileName}</p>
                        <p className="text-[10.5px] text-[var(--text-muted)]">
                          {formatBytes(a.fileSize)} · {a.uploader?.username ?? '—'} · {timeAgo(a.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a href={a.filePath} target="_blank" rel="noopener noreferrer"
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[#E30019]">
                          <ExternalLink size={13} />
                        </a>
                        <button onClick={() => deleteAttachMut.mutate(a.id)}
                          disabled={deleteAttachMut.isPending}
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[#BE123C] disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ACTIVITY ── */}
        {activeTab === 'activity' && (
          <div className="tm-drawer-body flex-1 overflow-y-auto p-5">
            {activityLoading ? (
              <div className="flex items-center gap-2 text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Đang tải…</div>
            ) : activity.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">
                <History size={28} className="mx-auto mb-2 opacity-30" />
                Chưa có hoạt động
              </div>
            ) : (
              <div>
                {activity.map((item: TaskActivityLogResponse, i: number) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div style={{ background: '#E30019' }}
                        className="mt-[3px] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-white">
                        {ACTIVITY_ICON[item.actionType] ?? <RefreshCw size={10} />}
                      </div>
                      {i < activity.length - 1 && <div className="my-1 w-[1px] flex-1 bg-[var(--bg-border)]" style={{ minHeight: 16 }} />}
                    </div>
                    <div className="pb-3">
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">
                        <span className="text-[#E30019]">{item.actor?.fullName ?? item.actor?.username ?? 'Hệ thống'}</span>
                        {' '}{item.actionType.toLowerCase().replace(/_/g, ' ')}
                      </p>
                      {item.newValue && (
                        <p className="text-[10.5px] text-[var(--text-secondary)]">
                          {Object.entries(item.newValue).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </p>
                      )}
                      <p className="text-[10.5px] text-[var(--text-muted)]">{timeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Drawer Footer: action buttons ── */}
        <div className="flex-shrink-0 border-t border-[var(--bg-border)] p-4">

          {/* Delete confirm banner */}
          {deleteConfirm && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FFF1F2] px-3 py-2 text-[12px]">
              <AlertTriangle size={14} className="text-[#BE123C] flex-shrink-0" />
              <span className="text-[#BE123C] font-medium flex-1">Xóa vĩnh viễn task này?</span>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="flex h-[26px] items-center gap-1 rounded-lg bg-[#E30019] px-3 text-[11.5px] font-semibold text-white disabled:opacity-50"
              >
                {deleteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Xóa
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex h-[26px] items-center rounded-lg border border-[var(--bg-border)] px-2 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                Hủy
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Hoàn thành */}
            <button
              onClick={() => completeMut.mutate()}
              disabled={!task || task.status === 'DONE' || task.status === 'CANCELLED' || completeMut.isPending}
              className="flex h-[32px] items-center gap-[5px] rounded-xl bg-[#F0FDF4] px-3 text-[12px] font-semibold text-[#15803D] hover:brightness-95 disabled:opacity-40 transition-all"
            >
              {completeMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <CircleCheck size={13} />}
              Hoàn thành
            </button>

            {/* Duyệt (move to REVIEW) */}
            <button
              onClick={() => adminTaskService.moveTask(task!.id, { targetStatus: 'REVIEW', targetPosition: 0 })
                .then(() => { void qc.invalidateQueries({ queryKey: ['kanban-board'] }); void qc.invalidateQueries({ queryKey: ['task-detail', taskId] }); notify.success('Chuyển sang Review'); })
                .catch(() => notify.error('Thất bại'))}
              disabled={!task || task.status === 'REVIEW' || task.status === 'DONE' || task.status === 'CANCELLED'}
              className="flex h-[32px] items-center gap-[5px] rounded-xl bg-[#FEF9C3] px-3 text-[12px] font-semibold text-[#92400E] hover:brightness-95 disabled:opacity-40 transition-all"
            >
              <ThumbsUp size={13} /> Review
            </button>

            {/* Huỷ task (move to CANCELLED) */}
            <button
              onClick={() => cancelMut.mutate()}
              disabled={!task || task.status === 'CANCELLED' || cancelMut.isPending}
              className="flex h-[32px] items-center gap-[5px] rounded-xl bg-[#FFF7ED] px-3 text-[12px] font-semibold text-[#C2410C] hover:brightness-95 disabled:opacity-40 transition-all"
            >
              {cancelMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
              Huỷ task
            </button>

            {/* Xóa task (soft delete) */}
            <button
              onClick={() => { setDeleteConfirm(true); setEditMode(false); }}
              disabled={!task}
              className="ml-auto flex h-[32px] items-center gap-[5px] rounded-xl bg-[#FFF1F2] px-3 text-[12px] font-semibold text-[#BE123C] hover:brightness-95 disabled:opacity-40 transition-all"
            >
              <Trash2 size={13} /> Xóa task
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Clean KPI Card (no trends, no mini charts) ────────────────────────────────

function KpiCard({ icon, value, label, color, loading }: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="tm-kpi flex flex-col gap-3 rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div
        style={{ background: color + '18', color }}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
      >
        {icon}
      </div>
      <div>
        <div style={{ color: loading ? undefined : undefined }}
          className="text-[28px] font-extrabold leading-none text-[var(--text-primary)]">
          {loading ? <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /> : value}
        </div>
        <div className="mt-[4px] text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</div>
      </div>
    </div>
  );
}



// ─── Create Task Modal ─────────────────────────────────────────────────────────

// ─── Create Task Modal ────────────────────────────────────────────────────────

// ─── Staff helpers ─────────────────────────────────────────────────────────────

const CUSTOMER_ROLES = ['CUSTOMER', 'customer', 'Customer'];
const AVATAR_COLORS = ['#7C3AED','#0369A1','#15803D','#C2410C','#BE123C','#E30019','#6D28D9','#0F6E56'];

function staffDisplayName(u: AdminUserResponse): string {
  return u.userInfo?.fullName?.trim() || u.username || `#${u.id}`;
}

function staffInitials(u: AdminUserResponse): string {
  const name = staffDisplayName(u);
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function staffAvatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function isNotCustomer(u: AdminUserResponse): boolean {
  if (!u.roles || u.roles.length === 0) return true;
  return !u.roles.some(r => CUSTOMER_ROLES.some(cr => r.toLowerCase() === cr.toLowerCase()));
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'ORDER_PREPARATION', label: '📦 Chuẩn bị đơn hàng' },
  { value: 'RETURN_PROCESSING', label: '↩️ Xử lý trả hàng'   },
  { value: 'PRICE_UPDATE',      label: '💰 Cập nhật giá'      },
  { value: 'PROMOTION_SETUP',   label: '🔥 Thiết lập khuyến mãi' },
  { value: 'MEETING',           label: '📅 Họp'               },
  { value: 'INVENTORY_CHECK',   label: '🎁 Kiểm tra tồn kho'  },
  { value: 'OTHER',             label: '📢 Khác'              },
];


const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string; bg: string }[] = [
  { value: 'NEW',         label: 'Mới',         color: '#1D4ED8', bg: '#EFF6FF' },
  { value: 'ASSIGNED',    label: 'Đã giao',     color: '#374151', bg: '#F1F5F9' },
  { value: 'IN_PROGRESS', label: 'Đang làm',    color: '#C2410C', bg: '#FFF7ED' },
  { value: 'REVIEW',      label: 'Đang duyệt',  color: '#92400E', bg: '#FEFCE8' },
  { value: 'DONE',        label: 'Hoàn thành',  color: '#15803D', bg: '#F0FDF4' },
  { value: 'CANCELLED',   label: 'Đã hủy',      color: '#BE123C', bg: '#FFF1F2' },
];

const TAG_OPTIONS = [
  { label: 'Backend',          bg: '#EFF6FF', color: '#1D4ED8' },
  { label: 'Frontend',         bg: '#F0FDF4', color: '#15803D' },
  { label: 'UI/UX',            bg: '#FAF5FF', color: '#6D28D9' },
  { label: 'API',              bg: '#FFF7ED', color: '#C2410C' },
  { label: 'Cơ sở dữ liệu',   bg: '#F0F9FF', color: '#0369A1' },
  { label: 'Marketing',        bg: '#FEFCE8', color: '#92400E' },
  { label: 'Tồn kho',          bg: '#FFF1F2', color: '#BE123C' },
  { label: 'Hỗ trợ khách hàng', bg: '#F0FDF4', color: '#0F6E56' },
];

const MODAL_STYLES = `
  .ctm-overlay { animation: ctmFadeIn .18s ease; }
  .ctm-panel   { animation: ctmSlideUp .22s ease; }
  @keyframes ctmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes ctmSlideUp { from { opacity: 0; transform: translateY(24px) scale(.97) } to { opacity: 1; transform: none } }
  .ctm-input {
    height: 38px; width: 100%; border-radius: 10px;
    border: 1.5px solid #E2E8F0; background: #F8FAFC;
    padding: 0 12px; font-size: 13px; color: #0F172A;
    outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .ctm-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.1); background: #fff; }
  .ctm-select {
    height: 38px; width: 100%; border-radius: 10px;
    border: 1.5px solid #E2E8F0; background: #F8FAFC;
    padding: 0 12px; font-size: 13px; color: #0F172A;
    outline: none; cursor: pointer; appearance: none;
    transition: border-color .15s;
  }
  .ctm-select:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.1); background: #fff; }
  .ctm-textarea {
    width: 100%; border-radius: 10px; border: 1.5px solid #E2E8F0;
    background: #F8FAFC; padding: 10px 12px; font-size: 13px; color: #0F172A;
    outline: none; resize: vertical; font-family: inherit;
    transition: border-color .15s, box-shadow .15s;
  }
  .ctm-textarea:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.1); background: #fff; }
  .ctm-label { display: block; font-size: 11.5px; font-weight: 600; color: #475569; margin-bottom: 5px; }
  .ctm-tag-pill { cursor: pointer; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; border: 1.5px solid transparent; transition: all .12s; }
  .ctm-checklist-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; }
  .ctm-range::-webkit-slider-thumb { width: 18px; height: 18px; border-radius: 50%; background: #7C3AED; cursor: pointer; -webkit-appearance: none; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(124,58,237,.4); }
  .ctm-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, #7C3AED var(--pct), #E2E8F0 var(--pct)); }
  .ctm-range { -webkit-appearance: none; width: 100%; height: 6px; background: transparent; outline: none; }
  .ctm-drop-zone { border: 2px dashed #CBD5E1; border-radius: 12px; padding: 20px; text-align: center; transition: all .15s; cursor: pointer; }
  .ctm-drop-zone:hover { border-color: #7C3AED; background: rgba(124,58,237,.03); }
  .ctm-drop-zone.drag-over { border-color: #7C3AED; background: rgba(124,58,237,.06); }
`;

let ctmStylesInjected = false;
function injectCtmStyles() {
  if (ctmStylesInjected) return;
  const el = document.createElement('style');
  el.textContent = MODAL_STYLES;
  document.head.appendChild(el);
  ctmStylesInjected = true;
}

function CreateTaskModal({ boardId, departments, onClose }: { boardId: number; departments: any[]; onClose: () => void }) {
  injectCtmStyles();
  const qc = useQueryClient();

  // ── Staff list ──
  const { data: staffResult, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-list-assignee'],
    queryFn: () => adminInternalStaffService.listPaged(0, 200),
    staleTime: 60_000,
  });
  const allStaff = (staffResult?.items ?? []).filter(isNotCustomer);

  // ── Form state ──
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [taskType, setTaskType]     = useState<TaskType>('OTHER');
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [priority, setPriority]     = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const staffDropRef = useRef<HTMLDivElement>(null);
  const [dueDate, setDueDate]       = useState('');
  const [progress, setProgress]     = useState(0);
  const [tags, setTags]             = useState<string[]>([]);
  const [newTag, setNewTag]         = useState('');
  const [checkItems, setCheckItems] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [notes, setNotes]           = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const [files, setFiles]           = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close staff dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (staffDropRef.current && !staffDropRef.current.contains(e.target as Node))
        setShowStaffDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredStaff = staffSearch.trim()
    ? allStaff.filter(u => staffDisplayName(u).toLowerCase().includes(staffSearch.toLowerCase()))
    : allStaff;

  const createMut = useMutation({
    mutationFn: () => adminTaskService.createTask({
      boardId,
      title: title.trim(),
      description: description.trim() || undefined,
      taskType,
      departmentId,
      priority,
      assigneeId: assigneeId ?? undefined,
      dueDate: dueDate || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
      notify.success('Task đã được tạo thành công!');
      onClose();
    },
    onError: () => notify.error('Tạo task thất bại'),
  });

  const TAG_COLORS = [
    { bg: '#EFF6FF', color: '#1D4ED8' }, { bg: '#F0FDF4', color: '#15803D' },
    { bg: '#FAF5FF', color: '#6D28D9' }, { bg: '#FFF7ED', color: '#C2410C' },
    { bg: '#F0F9FF', color: '#0369A1' }, { bg: '#FEFCE8', color: '#92400E' },
    { bg: '#FFF1F2', color: '#BE123C' }, { bg: '#F0FDF4', color: '#0F6E56' },
  ];
  const addTag = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) return;
    setTags(prev => [...prev, t]);
    setNewTag('');
  };
  const removeTag = (label: string) => setTags(prev => prev.filter(t => t !== label));

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setCheckItems(prev => [...prev, newCheckItem.trim()]);
    setNewCheckItem('');
  };

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return;
    setFiles(prev => [...prev, ...Array.from(fl)]);
  };

  const assignee = allStaff.find(u => u.id === assigneeId);
  const statusCfg = STATUS_OPTIONS[0]; // always NEW on create
  const pCfg = PRIORITY_CFG[priority];

  // Close on Escape
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };

  return (
    <div
      className="ctm-overlay fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)' }}
      onKeyDown={handleKey}
    >
      <div
        className="ctm-panel flex flex-col overflow-hidden"
        style={{
          width: 920, maxWidth: '97vw', maxHeight: '94vh',
          background: '#fff', borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.06)',
        }}
      >
        {/* ── Modal Header ── */}
        <div style={{ borderBottom: '1px solid #F1F5F9', padding: '20px 28px 16px' }}
          className="flex flex-shrink-0 items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-[3px]">
              <div style={{ background: '#7C3AED', borderRadius: 8, width: 28, height: 28 }}
                className="flex items-center justify-center">
                <Plus size={16} color="#fff" />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>Tạo Task Mới</h2>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginLeft: 36 }}>
              Tạo và giao task mới cho thành viên trong nhóm.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ borderRadius: 10, padding: 6, border: '1.5px solid #E2E8F0', color: '#64748B' }}
            className="hover:bg-slate-50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body: form left + sidebar right ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ── LEFT: Form ── */}
          <div style={{ flex: '1 1 0', borderRight: '1px solid #F1F5F9', overflowY: 'auto', padding: '20px 28px' }}
            className="tm-drawer-body space-y-5">

            {/* Basic Info */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                THÔNG TIN CƠ BẢN
              </p>
              <div className="space-y-3">
                <div>
                  <label className="ctm-label">Tiêu đề task <span style={{ color: '#E30019' }}>*</span></label>
                  <input
                    className="ctm-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề công việc..."
                    autoFocus
                  />
                </div>
                <div>
                  <label className="ctm-label">Mô tả</label>
                  <textarea
                    className="ctm-textarea"
                    rows={3}
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Mô tả chi tiết công việc cần thực hiện..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="ctm-label">Loại task <span style={{ color: '#E30019' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <select className="ctm-select" value={taskType}
                        onChange={e => setTaskType(e.target.value as TaskType)}>
                        {TASK_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label className="ctm-label">Phân loại <span style={{ color: '#E30019' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <select className="ctm-select" value={departmentId ?? -1}
                        onChange={e => setDepartmentId(Number(e.target.value) === -1 ? null : Number(e.target.value))}>
                        <option value={-1}>🌍 Chung</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>🏢 {d.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ctm-label">Trạng thái</label>
                    <div style={{ position: 'relative' }}>
                      <select className="ctm-select" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                        <option>🔵 NEW</option>
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label className="ctm-label">Mức độ ưu tiên</label>
                    <div style={{ position: 'relative' }}>
                      <select className="ctm-select" value={priority}
                        onChange={e => setPriority(e.target.value as TaskPriority)}>
                        <option value="URGENT">🔴 Critical</option>
                        <option value="HIGH">🟠 High</option>
                        <option value="MEDIUM">🟡 Medium</option>
                        <option value="LOW">🟢 Low</option>
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Assignment + Dates */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                PHÂN CÔNG & THỜI HẠN
              </p>
              <div className="grid grid-cols-3 gap-3">
                {/* Searchable Assignee Dropdown */}
                <div ref={staffDropRef} style={{ position: 'relative' }}>
                  <label className="ctm-label">Người phụ trách</label>
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => setShowStaffDrop(v => !v)}
                    className="ctm-input"
                    style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', textAlign: 'left' }}
                  >
                    {assignee ? (
                      <>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: staffAvatarColor(assignee.id), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {staffInitials(assignee)}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, color: '#0F172A' }}>
                          {staffDisplayName(assignee)}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 12.5 }}>— Chưa gán —</span>
                    )}
                    <ChevronDown size={12} style={{ marginLeft: 'auto', color: '#94A3B8', flexShrink: 0 }} />
                  </button>

                  {/* Dropdown panel */}
                  {showStaffDrop && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
                      background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: 4, overflow: 'hidden',
                    }}>
                      {/* Search input */}
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                          <input
                            autoFocus
                            className="ctm-input"
                            style={{ paddingLeft: 26, height: 32, fontSize: 12 }}
                            placeholder="Tìm tên nhân viên..."
                            value={staffSearch}
                            onChange={e => setStaffSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {/* Clear option */}
                        <button
                          type="button"
                          onClick={() => { setAssigneeId(null); setShowStaffDrop(false); setStaffSearch(''); }}
                          style={{ width: '100%', padding: '8px 12px', fontSize: 12, color: '#94A3B8', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                          className="hover:bg-slate-50"
                        >
                          <X size={12} /> Bỏ gán
                        </button>

                        {staffLoading ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Loader2 size={12} className="animate-spin" /> Đang tải...
                          </div>
                        ) : filteredStaff.length === 0 ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8' }}>Không tìm thấy</div>
                        ) : filteredStaff.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setAssigneeId(u.id); setShowStaffDrop(false); setStaffSearch(''); }}
                            style={{
                              width: '100%', padding: '8px 12px', fontSize: 12.5, textAlign: 'left',
                              display: 'flex', alignItems: 'center', gap: 9,
                              background: assigneeId === u.id ? '#F5F3FF' : 'transparent',
                              color: '#0F172A',
                            }}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: staffAvatarColor(u.id), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {staffInitials(u)}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {staffDisplayName(u)}
                              </div>
                              {u.username && (
                                <div style={{ fontSize: 10.5, color: '#94A3B8' }}>@{u.username}</div>
                              )}
                            </div>
                            {assigneeId === u.id && (
                              <CheckCircle2 size={13} style={{ marginLeft: 'auto', color: '#7C3AED', flexShrink: 0 }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="ctm-label">Ngày bắt đầu</label>
                  <input type="date" className="ctm-input" style={{ paddingRight: 8 }} />
                </div>
                <div>
                  <label className="ctm-label">Hạn hoàn thành</label>
                  <input type="date" className="ctm-input" style={{ paddingRight: 8 }}
                    value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Progress */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                TIẾN ĐỘ
              </p>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 16px', border: '1.5px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 12, color: '#64748B' }}>Hoàn thành</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{progress}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  className="ctm-range"
                  style={{ '--pct': `${progress}%` } as React.CSSProperties}
                  value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                />
                <div className="flex justify-between mt-1" style={{ fontSize: 10, color: '#CBD5E1' }}>
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
            </section>

            {/* Tags */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                NHÃN
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  className="ctm-input"
                  style={{ flex: 1 }}
                  placeholder="Nhập tên nhãn rồi nhấn Enter..."
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                />
                <button
                  onClick={addTag}
                  style={{ height: 38, padding: '0 14px', borderRadius: 10, background: '#F1F5F9', border: '1.5px solid #E2E8F0', fontSize: 12, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}
                  className="flex items-center gap-1 hover:bg-slate-200 transition-colors"
                >
                  <Plus size={12} /> Thêm
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-[6px]">
                  {tags.map((t, i) => {
                    const c = TAG_COLORS[i % TAG_COLORS.length];
                    return (
                      <span key={t} className="ctm-tag-pill flex items-center gap-[4px]"
                        style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.color}` }}>
                        {t}
                        <button onClick={() => removeTag(t)} style={{ color: c.color, opacity: 0.6, lineHeight: 1 }}
                          className="hover:opacity-100">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {tags.length === 0 && (
                <p style={{ fontSize: 11.5, color: '#CBD5E1', fontStyle: 'italic' }}>Chưa có nhãn nào</p>
              )}
            </section>

            {/* Attachments */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                TẬP TIN ĐÍNH KÈM
              </p>
              <div
                className={`ctm-drop-zone${dragOver ? ' drag-over' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              >
                <Paperclip size={22} style={{ margin: '0 auto 8px', color: '#94A3B8' }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Kéo thả file vào đây hoặc <span style={{ color: '#7C3AED' }}>chọn từ máy</span>
                </p>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                  Hỗ trợ: PDF, Word, Excel, ảnh · Tối đa 20MB
                </p>
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => handleFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11.5 }}>
                      <FileText size={13} style={{ color: '#7C3AED' }} />
                      <span style={{ flex: 1, color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: '#94A3B8' }}>{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ color: '#94A3B8' }} className="hover:text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Checklist */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                CHECKLIST
              </p>
              <div className="space-y-2 mb-2">
                {checkItems.map((item, i) => (
                  <div key={i} className="ctm-checklist-item">
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid #CBD5E1', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: '#334155' }}>{item}</span>
                    <button onClick={() => setCheckItems(prev => prev.filter((_, j) => j !== i))}
                      style={{ color: '#CBD5E1' }} className="hover:text-red-400 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="ctm-input" style={{ flex: 1 }}
                  placeholder="Thêm mục checklist..."
                  value={newCheckItem}
                  onChange={e => setNewCheckItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCheckItem(); }}
                />
                <button
                  onClick={addCheckItem}
                  style={{ height: 38, padding: '0 14px', borderRadius: 10, background: '#F1F5F9', border: '1.5px solid #E2E8F0', fontSize: 12, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}
                  className="hover:bg-slate-200 transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Thêm
                </button>
              </div>
            </section>

            {/* Notes */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 12 }}>
                GHI CHÚ BAN ĐẦU
              </p>
              <textarea
                className="ctm-textarea"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú hoặc hướng dẫn thêm cho thành viên..."
              />
            </section>
          </div>

          {/* ── RIGHT: Sidebar summary ── */}
          <div style={{ width: 268, flexShrink: 0, overflowY: 'auto', padding: '20px 20px', background: '#FAFAFA' }}
            className="tm-drawer-body space-y-4">

            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em' }}>
              XEM TRƯỚC TASK
            </p>

            {/* Mini Kanban Card Preview */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0',
              borderLeft: `4px solid ${pCfg.border}`,
              padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(0,0,0,.06)',
            }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>
                  #AUTO · {TYPE_CFG[taskType]?.short ?? 'TASK'}
                </span>
                <span style={{ background: TYPE_CFG[taskType]?.bg, color: TYPE_CFG[taskType]?.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px' }}>
                  {TYPE_CFG[taskType]?.short}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 8, lineHeight: 1.35, minHeight: 18 }}>
                {title || <span style={{ color: '#CBD5E1' }}>Tiêu đề task...</span>}
              </p>
              <div className="mb-2">
                <span style={{ background: pCfg.bg, color: pCfg.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: pCfg.dot, display: 'inline-block' }} />
                  {pCfg.label}
                </span>
              </div>
              {progress > 0 && (
                <div className="mb-2">
                  <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: pCfg.border, borderRadius: 2 }} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                {assignee ? (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: staffAvatarColor(assignee.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                    {staffInitials(assignee)}
                  </div>
                ) : (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px dashed #CBD5E1' }} />
                )}
                <div className="flex items-center gap-1" style={{ fontSize: 10, color: '#94A3B8' }}>
                  {dueDate && <><Calendar size={10} />{new Date(dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</>}
                </div>
              </div>
            </div>

            {/* Summary fields */}
            {[
              { label: 'Mã công việc',   value: '#TỰ SINH' },
              { label: 'Trạng thái',     value: '🔵 Mới' },
              { label: 'Ưu tiên',        value: `${PRIORITY_EMOJI[priority]} ${pCfg.label}` },
              { label: 'Người phụ trách', value: assignee ? staffDisplayName(assignee) : '— Chưa gán —' },
              { label: 'Hạn hoàn thành', value: dueDate ? new Date(dueDate).toLocaleDateString('vi-VN') : '— Chưa đặt —' },
              { label: 'Nhãn',           value: tags.length > 0 ? tags.join(', ') : '— Chưa có —' },
              { label: 'Tiến độ',        value: `${progress}%` },
              { label: 'Danh sách việc', value: `${checkItems.length} mục` },
              { label: 'Tập tin',        value: files.length > 0 ? `${files.length} file` : '— Chưa có —' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{value}</div>
              </div>
            ))}

            {/* Tags preview */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-[4px] pt-1">
                {tags.map((t, i) => {
                  const c = TAG_COLORS[i % TAG_COLORS.length];
                  return (
                    <span key={t} style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '2px 8px' }}>
                      {t}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '14px 28px', background: '#FAFAFA', flexShrink: 0 }}
          className="flex items-center justify-between">
          <button
            style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 12.5, fontWeight: 600, color: '#475569', background: '#fff' }}
            className="flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <FileText size={13} /> Lưu nháp
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 12.5, fontWeight: 600, color: '#475569', background: '#fff' }}
              className="hover:bg-slate-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || createMut.isPending}
              style={{ height: 36, padding: '0 20px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: '#7C3AED', color: '#fff', border: 'none', opacity: (!title.trim() || createMut.isPending) ? 0.5 : 1 }}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
            >
              {createMut.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Đang tạo...</>
                : <><Plus size={13} /> Tạo Task</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function AdminTaskManagementPage() {
  injectStyles();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [view, setView] = useState<'kanban' | 'list' | 'calendar' | 'gantt'>('kanban');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // ── Drag-and-drop state ──
  const [draggingTaskId,     setDraggingTaskId]     = useState<number | null>(null);
  const [dragOverCol,        setDragOverCol]        = useState<TaskStatus | null>(null);
  const dragCounter = useRef<Record<string, number>>({});   // track enter/leave per column

  const { data: board, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kanban-board', 'default'],
    queryFn: ({ signal }) => adminTaskService.getDefaultBoard(signal),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments-list'],
    queryFn: () => adminDepartmentService.list(),
    staleTime: 5 * 60_000,
  });

  const boardId = board?.boardId ?? DEFAULT_BOARD_ID;
  const stats = board?.stats;
  const columns = board?.columns ?? {} as Record<TaskStatus, TaskResponse[]>;

  const byStatus = useCallback((status: TaskStatus): TaskResponse[] => {
    const list = columns[status] ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      t.title.toLowerCase().includes(q) || String(t.id).includes(q)
    );
  }, [columns, search]);

  // ── Move task mutation (unrestricted — any status → any status) ──
  const qc = useQueryClient();
  const moveMut = useMutation({
    mutationFn: ({ taskId, targetStatus, targetPosition }: {
      taskId: number; targetStatus: TaskStatus; targetPosition: number;
    }) => adminTaskService.moveTask(taskId, { targetStatus, targetPosition }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kanban-board'] });
    },
    onError: () => notify.error('Di chuyển task thất bại'),
  });

  // ── Drag handlers ──
  const handleDragStart = (e: React.DragEvent, task: TaskResponse) => {
    setDraggingTaskId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', String(task.id));
    e.dataTransfer.setData('fromStatus', task.status);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverCol(null);
    dragCounter.current = {};
  };

  const handleDragEnter = (e: React.DragEvent, colKey: TaskStatus) => {
    e.preventDefault();
    dragCounter.current[colKey] = (dragCounter.current[colKey] ?? 0) + 1;
    setDragOverCol(colKey);
  };

  const handleDragLeave = (e: React.DragEvent, colKey: TaskStatus) => {
    dragCounter.current[colKey] = (dragCounter.current[colKey] ?? 1) - 1;
    if ((dragCounter.current[colKey] ?? 0) <= 0) {
      dragCounter.current[colKey] = 0;
      setDragOverCol(prev => prev === colKey ? null : prev);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    dragCounter.current[targetStatus] = 0;
    setDragOverCol(null);

    const taskId = Number(e.dataTransfer.getData('taskId'));
    const fromStatus = e.dataTransfer.getData('fromStatus') as TaskStatus;
    if (!taskId || fromStatus === targetStatus) return;

    const targetList = columns[targetStatus] ?? [];
    const targetPosition = targetList.length; // append to end

    moveMut.mutate({ taskId, targetStatus, targetPosition });
    setDraggingTaskId(null);
  };

  const VIEWS = [
    { k: 'kanban'   as const, icon: <LayoutGrid   size={13} />, label: 'Kanban'     },
    { k: 'list'     as const, icon: <ListTodo     size={13} />, label: 'Danh sách'  },
    { k: 'calendar' as const, icon: <CalendarDays size={13} />, label: 'Lịch'       },
    { k: 'gantt'    as const, icon: <GanttChart   size={13} />, label: 'Gantt'      },
  ];

  return (
    <div
      className="tm-page flex h-full flex-col gap-4 overflow-hidden"
      style={{ padding: '18px 22px 12px', background: 'var(--bg-page, #F8FAFC)' }}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
        <div className="mr-1">
          <h1 className="whitespace-nowrap text-[16px] font-bold leading-tight text-[var(--text-primary)]">
            Quản lý công việc
          </h1>
          <p className="text-[11px] text-[var(--text-muted)]">Bảng điều hành EcomX</p>
        </div>

        <div className="relative" style={{ width: 240 }}>
          <Search size={13} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm công việc..."
            className="h-[34px] w-full rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] pl-[30px] pr-3 text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[#E30019] focus:shadow-[0_0_0_3px_rgba(227,0,25,.06)] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-[5px]">
          {['Phòng ban', 'Loại task', 'Ưu tiên', 'Người phụ trách'].map(f => (
            <button key={f}
              className="flex h-[30px] items-center gap-[3px] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-[10px] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              {f} <ChevronDown size={9} />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void refetch()}
            className="flex h-[30px] items-center gap-[4px] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="flex h-[30px] items-center gap-[4px] rounded-xl border border-[rgba(109,40,217,.3)] bg-[rgba(109,40,217,.07)] px-3 text-[11.5px] font-semibold text-[#6D28D9] hover:bg-[rgba(109,40,217,.13)] transition-colors">
            <CalendarCheck size={12} /> Cuộc họp
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex h-[30px] items-center gap-[4px] rounded-xl bg-[#E30019] px-4 text-[11.5px] font-semibold text-white hover:opacity-90 transition-opacity shadow-sm">
            <Plus size={13} /> New Task
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="flex gap-[2px] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-[3px]">
          {VIEWS.map(v => (
            <button key={v.k} onClick={() => setView(v.k)}
              style={view === v.k ? { background: 'var(--bg-elevated)', boxShadow: '0 1px 4px rgba(0,0,0,.06)' } : {}}
              className="tm-vtab flex items-center gap-[5px] rounded-[9px] px-3 py-[5px] text-[12px] font-medium transition-all">
              <span style={{ color: view === v.k ? '#E30019' : 'var(--text-muted)' }}>{v.icon}</span>
              <span style={{ color: view === v.k ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{v.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {draggingTaskId && (
            <span className="flex items-center gap-1 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/08 px-3 py-[5px] text-[11px] font-semibold text-[#6D28D9]">
              <Package size={11} /> Keo tha vao cot bat ky...
            </span>
          )}
          <select className="h-[30px] cursor-pointer rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] px-3 text-[11.5px] text-[var(--text-secondary)] outline-none hover:bg-[var(--bg-elevated)] transition-colors">
            <option>Sap xep: Uu tien</option>
            <option>Sap xep: Deadline</option>
            <option>Sap xep: Ngay tao</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {isError && (() => {
        const msg = (error as Error)?.message ?? '';
        const isEmpty = msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('board');
        return isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--bg-border)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-elevated)]">
              <ListTodo size={28} className="text-[var(--text-muted)]" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-[var(--text-primary)]">Chua co board nao</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">Khoi dong backend de tao board mac dinh tu dong</p>
            </div>
            <button onClick={() => void refetch()}
              className="flex h-[36px] items-center gap-2 rounded-xl bg-[#E30019] px-5 text-[13px] font-semibold text-white hover:opacity-90">
              <RefreshCw size={13} /> Thu lai
            </button>
          </div>
        ) : (
          <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FFF1F2] p-3 text-[12.5px] text-[#BE123C]">
            <AlertTriangle size={16} />
            Khong the tai du lieu. Kiem tra ket noi server hoac dang nhap lai.
            <button onClick={() => void refetch()} className="ml-auto underline text-[#E30019]">Thu lai</button>
          </div>
        );
      })()}

      {/* Kanban Board */}
      {view === 'kanban' && !isError && (
        <div
          className="tm-kanban flex min-h-0 flex-1 gap-[10px] overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {COLUMNS.map(col => {
            const colTasks = byStatus(col.key);
            const isOver   = dragOverCol === col.key;
            const canAdd   = col.key !== 'DONE' && col.key !== 'CANCELLED';

            return (
              <div
                key={col.key}
                style={{ minWidth: 246, maxWidth: 246 }}
                className="flex flex-col gap-[7px]"
              >
                {/* Column header */}
                <div
                  style={{ background: col.hBg, borderColor: isOver ? '#7C3AED' : col.hBorder }}
                  className="flex flex-shrink-0 items-center justify-between rounded-xl border px-[11px] py-[9px] transition-colors"
                >
                  <div className="flex items-center gap-[7px]">
                    <div style={{ background: isOver ? '#7C3AED' : col.dot, transition: 'background .12s' }}
                      className="h-[8px] w-[8px] flex-shrink-0 rounded-full" />
                    <span style={{ color: isOver ? '#7C3AED' : col.hColor }}
                      className="text-[11.5px] font-bold tracking-wide transition-colors">
                      {col.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-[5px]">
                    <span style={{ background: col.cntBg, color: col.cntColor }}
                      className="rounded-full px-[9px] py-[1.5px] text-[10.5px] font-bold">
                      {isLoading ? '...' : colTasks.length}
                    </span>
                    {canAdd && (
                      <button onClick={() => setShowCreate(true)}
                        style={{ color: col.hColor }}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-md opacity-50 hover:opacity-100 transition-opacity">
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Drop zone + task cards */}
                <div
                  className={`tm-col-drop tm-kbody flex flex-1 flex-col gap-[7px] overflow-y-auto rounded-xl border-2 border-dashed p-1 transition-all${isOver ? ' drag-over' : ''}`}
                  style={{
                    scrollbarWidth: 'thin',
                    minHeight: 80,
                    borderColor: isOver ? '#7C3AED' : 'transparent',
                    background: isOver ? 'rgba(124,58,237,.04)' : 'transparent',
                  }}
                  onDragEnter={e => handleDragEnter(e, col.key)}
                  onDragLeave={e => handleDragLeave(e, col.key)}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, col.key)}
                >
                  {isLoading
                    ? [1, 2].map(i => (
                        <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
                      ))
                    : colTasks.length === 0
                    ? (
                        <div className={`flex flex-col items-center justify-center gap-1 rounded-xl py-8 text-center transition-all${isOver ? '' : ' border border-dashed border-[var(--bg-border)]'}`}>
                          {isOver ? (
                            <>
                              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-[#7C3AED]">
                                <Plus size={18} style={{ color: '#7C3AED' }} />
                              </div>
                              <p className="text-[11px] font-semibold text-[#7C3AED]">Tha vao day</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} className="text-[var(--text-muted)] opacity-25" />
                              <p className="text-[10.5px] text-[var(--text-muted)]">Khong co task</p>
                            </>
                          )}
                        </div>
                      )
                    : colTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTaskId(task.id)}
                          onDragStart={e => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggingTaskId === task.id}
                        />
                      ))
                  }

                  {/* Drop hint when column has tasks */}
                  {isOver && colTasks.length > 0 && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#7C3AED] py-3">
                      <Plus size={14} style={{ color: '#7C3AED' }} />
                      <span className="text-[11px] font-semibold text-[#7C3AED]">Tha vao day</span>
                    </div>
                  )}
                </div>

                {/* Add task footer */}
                {canAdd && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="tm-add-btn flex h-[32px] w-full flex-shrink-0 items-center justify-center gap-[4px] rounded-xl border border-dashed border-[var(--bg-border)] text-[11.5px] text-[var(--text-muted)] transition-colors"
                  >
                    <Plus size={12} /> Them task
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Placeholder for other views */}
      {view !== 'kanban' && !isError && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--bg-border)]">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-20 text-[var(--text-muted)]">
              {view === 'list'     && <ListTodo     size={40} />}
              {view === 'calendar' && <CalendarDays size={40} />}
              {view === 'gantt'    && <GanttChart   size={40} />}
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-secondary)]">
              {view === 'list' ? 'List view' : view === 'calendar' ? 'Calendar view' : 'Gantt view'}
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Tinh nang dang phat trien</p>
          </div>
        </div>
      )}

      {/* Modals & Drawer */}
      {showCreate && <CreateTaskModal boardId={boardId} departments={departments} onClose={() => setShowCreate(false)} />}
      <TaskDrawer taskId={selectedTaskId} departments={departments} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}

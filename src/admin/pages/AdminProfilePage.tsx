import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, Key, Shield, User, Briefcase, Mail, Phone, Activity } from 'lucide-react';
import { authService } from '../../api/services';
import { notify } from '../../utils/notify';
import type { UserInfo } from '../../api/types/auth.types';
import clsx from 'clsx';
import { useAuth } from '../../app/auth/AuthProvider';

export default function AdminProfilePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery<UserInfo>({
    queryKey: ['admin-profile'],
    queryFn: () => authService.fetchCurrentUser(),
    initialData: user || undefined,
  });

  const [editFullName, setEditFullName] = useState(profile?.userInfo?.fullName || '');
  const [editEmail, setEditEmail] = useState(profile?.email || '');
  const [editPhone, setEditPhone] = useState(profile?.phoneNumber || profile?.userInfo?.telephone || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.userInfo?.avatar || null);

  // Password fields
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync state when profile is loaded
  React.useEffect(() => {
    if (profile) {
      setEditFullName(profile.userInfo?.fullName || '');
      setEditEmail(profile.email || '');
      setEditPhone(profile.phoneNumber || profile.userInfo?.telephone || '');
      setAvatarPreview(profile.userInfo?.avatar || null);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      // Update basic info (name, avatar, phone)
      await authService.updateProfile({
        fullName: editFullName,
        telephone: editPhone,
        email: editEmail,
        phoneNumber: editPhone,
        avatarFile: avatarFile,
      });
      // Email/phone require password if changed in current backend logic? 
      // We will rely on changeContact if needed, but the prompt says just update profile.
      // If email/phone changes require contact update, we would use authService.changeContact, 
      // but let's try updateProfile first as telephone is there.
    },
    onSuccess: () => {
      notify.success('Cập nhật hồ sơ thành công');
      qc.invalidateQueries({ queryKey: ['admin-profile'] });
    },
    onError: (err: any) => {
      notify.error(err.message || 'Cập nhật thất bại');
    }
  });
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
    },
    onSuccess: () => {
      notify.success('Đổi mật khẩu thành công');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      notify.error(err.message || 'Đổi mật khẩu thất bại');
    }
  });

  const handleSavePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify.error('Vui lòng nhập đầy đủ thông tin mật khẩu');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error('Mật khẩu xác nhận không khớp');
      return;
    }
    changePasswordMutation.mutate();
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate();
  };

  if (isLoading && !profile) {
    return <div className="p-8 text-center text-[var(--text-secondary)]">Đang tải hồ sơ...</div>;
  }

  // Type assertion to access extra fields the backend might return
  const rawProfile: any = profile || {};
  const sapCode = rawProfile.manId || `SAP-${profile?.id || 'N/A'}`;
  const statusLabel = profile?.status === 1 ? 'Hoạt động' : 'Ngừng hoạt động';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Hồ sơ cá nhân</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Quản lý thông tin tài khoản và bảo mật của bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Read-only Info */}
        <div className="space-y-6 md:col-span-1">
          <div className="rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
              <Shield size={14} /> Mã SAP & Đăng nhập
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Mã SAP</label>
                <div className="mt-1 flex items-center justify-between rounded-lg bg-[var(--bg-base)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                  <span>{sapCode}</span>
                  <button onClick={() => { navigator.clipboard.writeText(sapCode); notify.success('Đã sao chép'); }} className="text-xs text-[var(--accent)] hover:underline">Sao chép</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Username</label>
                <div className="mt-1 rounded-lg bg-[var(--bg-base)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                  {profile?.username || '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
              <Activity size={14} /> Phân quyền & Trạng thái
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Trạng thái</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className={clsx("h-2.5 w-2.5 rounded-full", profile?.status === 1 ? 'bg-green-500' : 'bg-red-500')} />
                  <span className="text-sm font-medium text-[var(--text-primary)]">{statusLabel}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Chức vụ / Quyền</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile?.roles?.map((r, idx) => (
                    <span key={idx} className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs font-bold text-[var(--accent)] border border-[var(--accent-soft)]">
                      {r.replace('ROLE_', '')}
                    </span>
                  ))}
                  {(!profile?.roles || profile.roles.length === 0) && (
                    <span className="text-sm text-[var(--text-muted)]">Chưa phân quyền</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Info */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <h2 className="mb-6 text-sm font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
              <User size={14} /> Thông tin cơ bản
            </h2>

            {/* Avatar Section */}
            <div className="mb-8 flex items-center gap-6">
              <div className="relative h-24 w-24 shrink-0 rounded-full border-4 border-[var(--bg-base)] shadow-md bg-[var(--bg-elevated)]">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                    <User size={32} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-[var(--accent)] p-2 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                >
                  <Camera size={14} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Ảnh đại diện</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">Định dạng JPG, PNG hoặc GIF. Dung lượng tối đa 5MB.</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Họ và tên</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Briefcase className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                    placeholder="Nhập họ và tên..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Email</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Số điện thoại</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Phone className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                    placeholder="0912345678"
                  />
                </div>
              </div>
            </div>

            {/* Password Fields */}
            {isChangingPassword && (
              <div className="mt-8 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-5">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Đổi mật khẩu</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Mật khẩu hiện tại</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Key className="h-4 w-4 text-[var(--text-muted)]" />
                      </div>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Mật khẩu mới</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Key className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                          placeholder="Mật khẩu mới"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Xác nhận mật khẩu</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Key className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="block w-full rounded-lg border border-[var(--bg-border)] bg-[var(--bg-base)] p-2.5 pl-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                          placeholder="Xác nhận mật khẩu mới"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSavePassword}
                      disabled={changePasswordMutation.isPending}
                      className="rounded-lg bg-[var(--text-primary)] px-5 py-2 text-sm font-bold text-[var(--bg-base)] hover:opacity-90 transition-opacity disabled:opacity-70"
                    >
                      {changePasswordMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex items-center justify-between border-t border-[var(--bg-border)] pt-6">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bg-border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors"
                onClick={() => setIsChangingPassword(!isChangingPassword)}
              >
                <Key size={16} /> {isChangingPassword ? 'Hủy đổi mật khẩu' : 'Đổi mật khẩu'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-bold text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-70"
              >
                {updateProfileMutation.isPending ? 'Đang lưu...' : <><Save size={16} /> Lưu thay đổi</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

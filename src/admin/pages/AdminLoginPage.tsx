import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useLogin } from '../../hooks/useLogin';
import { authInputClass } from '../../lib/authFormClasses';
import { cn } from '../../lib/cn';
import { AdminThemeToggle } from '../components/AdminThemeToggle';
import { useAdminThemeStore } from '../theme/adminThemeStore';

export default function AdminLoginPage() {
  const mode = useAdminThemeStore((s) => s.mode);
  const {
    login,
    password,
    showPassword,
    loading,
    emailError,
    passwordError,
    apiError,
    getPlaceholder,
    handleEmailChange,
    handlePasswordChange,
    togglePasswordVisibility,
    handleLogin,
  } = useLogin();

  return (
    <div
      className="admin-portal relative flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-10"
      data-admin-theme={mode}
    >
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <AdminThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            to="/login"
            className="inline-flex flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <div className="rounded-xl bg-[var(--accent-soft)] px-6 py-3 shadow-[0_0_20px_var(--accent-glow)]">
              <span className="font-[family-name:var(--font-admin-heading)] text-xl font-bold tracking-tight text-[var(--accent)]">
                Ecomx-admin
              </span>
            </div>
            <span className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              Ecomx-admin — đăng nhập nhân viên
            </span>
          </Link>
        </div>

        <div
          className={clsx(
            'rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6',
            'shadow-[var(--card-shadow)]'
          )}
        >
          <h1 className="text-center font-[family-name:var(--font-admin-heading)] text-lg font-semibold text-[var(--text-primary)]">
            Đăng nhập
          </h1>

          <form onSubmit={handleLogin} className="mt-6 space-y-5" noValidate>
            {apiError ? (
              <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-3.5">
                <p className="text-sm font-medium text-[var(--danger)]">{apiError}</p>
              </div>
            ) : null}

            <div>
              <label htmlFor="admin-login-input" className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">
                Email / SĐT / Username
              </label>
              <input
                id="admin-login-input"
                type="text"
                placeholder={getPlaceholder()}
                value={login}
                onChange={handleEmailChange}
                disabled={loading}
                className={cn(authInputClass(Boolean(emailError), loading), 'bg-[var(--bg-elevated)] text-[var(--text-primary)]')}
                autoComplete="username"
              />
              {emailError ? <p className="mt-1.5 text-xs text-[var(--danger)]">{emailError}</p> : null}
            </div>

            <div>
              <label htmlFor="admin-login-password" className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  className={cn(
                    authInputClass(Boolean(passwordError), loading),
                    'bg-[var(--bg-elevated)] text-[var(--text-primary)] pe-24'
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              {passwordError ? <p className="mt-1.5 text-xs text-[var(--danger)]">{passwordError}</p> : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full rounded-lg py-2.5 text-sm font-bold text-white transition-colors',
                'bg-[var(--accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
            >
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Tài khoản khách hàng không được dùng bảng quản trị này.
        </p>
      </div>
    </div>
  );
}

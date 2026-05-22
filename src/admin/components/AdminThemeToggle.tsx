import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { useAdminThemeStore } from '../theme/adminThemeStore';

type Props = {
  className?: string;
};

export function AdminThemeToggle({ className }: Props) {
  const mode = useAdminThemeStore((s) => s.mode);
  const toggleMode = useAdminThemeStore((s) => s.toggleMode);
  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={isDark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}
      aria-pressed={isDark}
      className={clsx(
        'rounded-lg p-2 text-[var(--text-secondary)] transition-colors',
        'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        className
      )}
    >
      {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

import type { ReactNode } from 'react';

export type AppToastVariant = 'success' | 'error' | 'info';

const variantStyles: Record<
  AppToastVariant,
  { wrapper: string; iconWrap: string; icon: ReactNode; title: string }
> = {
  success: {
    wrapper: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconWrap: 'bg-white border-emerald-300 text-emerald-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Thành công'
  },
  error: {
    wrapper: 'bg-rose-50 border-rose-200 text-rose-800',
    iconWrap: 'bg-white border-rose-300 text-rose-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86l-8.02 14A2 2 0 004 21h16a2 2 0 001.73-3.14l-8.02-14a2 2 0 00-3.46 0z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Có lỗi'
  },
  info: {
    wrapper: 'bg-sky-50 border-sky-200 text-sky-800',
    iconWrap: 'bg-white border-sky-300 text-sky-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Thông báo'
  }
};

interface AppToastProps {
  variant: AppToastVariant;
  message: string;
  subtitle?: string;
}

export default function AppToast({ variant, message, subtitle }: AppToastProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={[
        'w-[min(520px,calc(100vw-32px))]',
        'rounded-2xl border shadow-[0_16px_40px_-20px_rgba(2,6,23,0.35)]',
        'px-5 py-4',
        styles.wrapper
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <div
          className={[
            'w-12 h-12 rounded-full border flex items-center justify-center',
            styles.iconWrap
          ].join(' ')}
          aria-hidden="true"
        >
          {styles.icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{styles.title}</p>
          <p className="mt-1 text-[15px] font-medium leading-6 break-words">{message}</p>
          {subtitle ? <p className="mt-0.5 text-sm opacity-80 break-words">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}


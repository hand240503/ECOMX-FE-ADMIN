import type { ReactNode } from 'react';

export type AppToastVariant = 'success' | 'error' | 'warning' | 'info';

type VariantStyle = {
  /** Thanh accent bên trái + nền badge icon (Tailwind class tĩnh để không bị purge). */
  accent: string;
  badge: string;
  title: string;
  iconRing: string;
  label: string;
  icon: ReactNode;
};

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
};

const variantStyles: Record<AppToastVariant, VariantStyle> = {
  success: {
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-500',
    title: 'text-emerald-600',
    iconRing: 'ring-emerald-100',
    label: 'Thành công',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white">
        <path d="M20 6 9 17l-5-5" {...stroke} />
      </svg>
    ),
  },
  error: {
    accent: 'bg-rose-500',
    badge: 'bg-rose-500',
    title: 'text-rose-600',
    iconRing: 'ring-rose-100',
    label: 'Có lỗi',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white">
        <path d="M18 6 6 18M6 6l12 12" {...stroke} />
      </svg>
    ),
  },
  warning: {
    accent: 'bg-amber-500',
    badge: 'bg-amber-500',
    title: 'text-amber-600',
    iconRing: 'ring-amber-100',
    label: 'Lưu ý',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...stroke} />
        <path d="M12 9v4" {...stroke} />
        <path d="M12 17h.01" {...stroke} />
      </svg>
    ),
  },
  info: {
    accent: 'bg-sky-500',
    badge: 'bg-sky-500',
    title: 'text-sky-600',
    iconRing: 'ring-sky-100',
    label: 'Thông báo',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white">
        <path d="M12 16v-5" {...stroke} />
        <path d="M12 8h.01" {...stroke} />
        <circle cx="12" cy="12" r="9" {...stroke} />
      </svg>
    ),
  },
};

interface AppToastProps {
  variant: AppToastVariant;
  message: string;
  subtitle?: string;
}

export default function AppToast({ variant, message, subtitle }: AppToastProps) {
  const s = variantStyles[variant];

  return (
    <div
      className="relative flex w-[min(420px,calc(100vw-32px))] items-start gap-3 overflow-hidden rounded-2xl bg-white py-3.5 pl-5 pr-4 shadow-[0_12px_32px_-12px_rgba(2,6,23,0.28)] ring-1 ring-slate-900/5"
      role="status"
      aria-live="polite"
    >
      {/* Thanh accent màu bên trái */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${s.accent}`} aria-hidden="true" />

      {/* Badge icon đặc màu */}
      <span
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-4 ${s.badge} ${s.iconRing}`}
        aria-hidden="true"
      >
        {s.icon}
      </span>

      {/* Nội dung */}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-[12.5px] font-bold leading-4 ${s.title}`}>{s.label}</p>
        <p className="mt-1 break-words text-[14px] font-medium leading-snug text-slate-700">{message}</p>
        {subtitle ? (
          <p className="mt-0.5 break-words text-[12.5px] leading-snug text-slate-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

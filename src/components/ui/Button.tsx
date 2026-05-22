import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant =
  | 'profilePrimary'
  | 'profileGhost'
  | 'profileOutline'
  | 'authPrimary'
  | 'authSocial'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  profilePrimary: cn(
    'border-0 bg-[#1a94ff] text-white',
    'hover:brightness-[1.03] active:brightness-95',
    'disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:brightness-100'
  ),
  profileGhost: cn(
    'border border-gray-300 bg-white text-gray-700',
    'hover:border-gray-400',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),
  profileOutline: cn(
    'border border-primary bg-surface text-primary',
    'transition-all duration-200 ease-in-out',
    'hover:bg-primary hover:text-white',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-primary'
  ),
  authPrimary: cn(
    'w-full border-0 bg-gradient-to-r from-rose-500 to-red-500 text-white font-semibold',
    'shadow-md hover:shadow-lg hover:from-rose-600 hover:to-danger',
    'active:scale-[0.99] disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed',
    'disabled:shadow-md disabled:active:scale-100'
  ),
  authSocial: cn(
    'border border-slate-300 bg-white text-slate-700',
    'hover:bg-slate-50',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),
  outline: cn(
    'border border-slate-300 bg-white text-slate-800',
    'hover:bg-slate-50',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),
  ghost: cn(
    'border-0 bg-transparent text-slate-600',
    'hover:bg-slate-100 hover:text-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),
  danger: cn(
    'border-0 bg-danger text-white',
    'hover:bg-danger-emphasis',
    'disabled:bg-red-300 disabled:cursor-not-allowed'
  )
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-3.5 text-sm rounded-lg gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2'
};

/** Nút dùng chung: profile (xanh), auth (gradient / OAuth), outline, v.v. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'profilePrimary',
    size = 'md',
    fullWidth,
    loading,
    disabled,
    className,
    children,
    leftIcon,
    rightIcon,
    type = 'button',
    ...rest
  },
  ref
) {
  const isProfile =
    variant === 'profilePrimary' || variant === 'profileGhost' || variant === 'profileOutline';
  const isAuthPrimary = variant === 'authPrimary';

  const profileLayout = isProfile
    ? 'w-full min-[641px]:w-auto min-[641px]:min-w-[124px] justify-center font-medium'
    : '';

  const authPrimaryLayout = isAuthPrimary ? 'w-full justify-center py-3.5' : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500/40',
        variantClasses[variant],
        !isAuthPrimary && sizeClasses[size],
        isAuthPrimary && 'rounded-xl text-base',
        profileLayout,
        authPrimaryLayout,
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size={size === 'sm' ? 'sm' : 'md'} className={cn(isAuthPrimary && 'text-white')} />
          {children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

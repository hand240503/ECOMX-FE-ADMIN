import { cn } from './cn';

export const authLabelClass = cn('mb-2 block text-caption font-semibold text-text-primary');

export function authInputClass(error?: boolean, disabled?: boolean) {
  return cn(
    'w-full rounded-sm border bg-surface px-3 py-2.5 text-body text-text-primary placeholder:text-text-secondary',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-primary/20',
    error ? 'border-danger focus:border-danger focus:ring-danger/25' : 'border-border focus:border-primary',
    disabled && 'cursor-not-allowed bg-background text-text-disabled'
  );
}

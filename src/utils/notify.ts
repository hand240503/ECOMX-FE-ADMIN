import { createElement } from 'react';
import toast from 'react-hot-toast';
import AppToast, { type AppToastVariant } from '../components/AppToast';

type NotifyOptions = {
  duration?: number;
  subtitle?: string;
};

const show = (variant: AppToastVariant, message: string, options?: NotifyOptions) => {
  toast.custom(
    (t) => {
      // KHÔNG dùng position:fixed ở đây — react-hot-toast bọc toast trong 1 container có
      // transform, khiến fixed bị tính theo container (lệch/ngoài màn hình). Để Toaster tự định vị.
      const className = [
        'transition-all duration-200',
        t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      ].join(' ');

      return createElement(
        'div',
        { className },
        createElement(AppToast, { variant, message, subtitle: options?.subtitle })
      );
    },
    {
      duration: options?.duration ?? 2500
    }
  );
};

export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  warning: (message: string, options?: NotifyOptions) => show('warning', message, options),
  info: (message: string, options?: NotifyOptions) => show('info', message, options)
};


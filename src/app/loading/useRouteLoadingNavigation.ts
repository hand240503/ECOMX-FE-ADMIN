import { useCallback } from 'react';
import { createPath, useLocation, useNavigate } from 'react-router-dom';
import type { NavigateOptions, To } from 'react-router-dom';
import { useRouteLoadingState } from './RouteLoadingProvider';

interface NavigateWithLoadingOptions extends NavigateOptions {
  delayMs?: number;
}

export const useRouteLoadingNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRouteLoading, isTopLoadingBarVisible, startRouteTransition } = useRouteLoadingState();

  const navigateWithLoading = useCallback(
    (to: To, options?: NavigateWithLoadingOptions) => {
      const delayMs = options?.delayMs ?? 450;
      const { delayMs: _delayMs, ...navigateOptions } = options ?? {};
      void _delayMs;

      const targetPath = typeof to === 'string' ? to : createPath(to);
      const currentPath = `${location.pathname}${location.search}${location.hash}`;

      if (targetPath === currentPath || isRouteLoading) {
        return;
      }

      startRouteTransition(() => {
        navigate(to, navigateOptions);
      }, delayMs);
    },
    [isRouteLoading, location.hash, location.pathname, location.search, navigate, startRouteTransition]
  );

  return {
    isRouteLoading,
    isTopLoadingBarVisible,
    navigateWithLoading,
    startRouteTransition
  };
};


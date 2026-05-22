import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA không reset scroll khi đổi route — viewport giữ nguyên vị trí trang trước.
 * Gọi scroll về đầu khi URL thay đổi (pathname + query).
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

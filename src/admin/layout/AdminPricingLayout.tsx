import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Tag, Clock, Layers, Gift, Ruler } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminPromotionService } from '../../api/services/adminPromotionService';

type PricingNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Trạng thái dot: success = đang chạy, warning = chờ duyệt, undefined = không có */
  dot?: 'success' | 'warning';
};

/** Aggregator: PwP active count → success dot trên item PwP */
function usePricingNavStatus(): { pwp: PricingNavItem['dot'] } {
  const offersQuery = useQuery({
    queryKey: ['admin-pwp-offers'],
    queryFn: ({ signal }) => adminPromotionService.listPurchaseWithPurchase(signal),
    staleTime: 60_000,
  });
  const offers = offersQuery.data ?? [];
  const hasActive = offers.some((o) => o.enabled);
  return { pwp: hasActive ? 'success' : undefined };
}

export function AdminPricingLayout() {
  const { pathname } = useLocation();
  const status = usePricingNavStatus();

  const items: PricingNavItem[] = [
    { to: '/admin/pricing/catalog', label: 'Giá niêm yết (catalog)', icon: Tag },
    { to: '/admin/pricing/time-change', label: 'Giá theo khung thời gian', icon: Clock },
    { to: '/admin/pricing/volume', label: 'Giá theo bậc số lượng (volume)', icon: Layers },
    { to: '/admin/pricing/pwp', label: 'Chương trình mua kèm (PwP)', icon: Gift, dot: status.pwp },
    { to: '/admin/pricing/units', label: 'Đơn vị tính', icon: Ruler },
  ];

  // Đảm bảo highlight active khi vào /admin/pricing (root) — dùng prefix
  const isItemActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        className={clsx(
          'w-full shrink-0 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-3',
          'shadow-[var(--card-shadow)] lg:sticky lg:top-20 lg:w-[220px]'
        )}
      >
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Giá &amp; khuyến mãi
        </p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isItemActive(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={clsx(
                    'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    active
                      ? 'border border-[var(--bg-border)] bg-[var(--bg-elevated)] font-medium text-[var(--text-primary)] shadow-sm'
                      : 'border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'size-4 shrink-0',
                      active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.dot ? (
                    <span
                      className={clsx(
                        'size-1.5 rounded-full',
                        item.dot === 'success' ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'
                      )}
                      aria-label={
                        item.dot === 'success'
                          ? 'Có chương trình mua kèm đang bật'
                          : 'Có hạng mục chờ xử lý hoặc duyệt'
                      }
                    />
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-[var(--bg-border)] px-2 pb-1 pt-3 text-[11px] text-[var(--text-muted)]">
          <p className="mb-1 font-semibold text-[var(--text-secondary)]">Ký hiệu trên menu</p>
          <p className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
            Chương trình PwP đang bật
          </p>
          <p className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--warning)]" aria-hidden />
            Cần duyệt / nháp (khi áp dụng)
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <Outlet />
      </div>
    </div>
  );
}

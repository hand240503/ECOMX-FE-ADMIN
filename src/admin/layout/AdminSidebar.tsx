import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PanelLeftClose } from 'lucide-react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { adminNavSections, type AdminNavItem } from '../adminNav';

function sidebarItemRowActive(pathname: string, item: AdminNavItem): boolean {
  const hasChildren = Boolean(item.children?.length);
  if (item.to === '/admin') {
    return matchPath({ path: '/admin', end: true }, pathname) != null;
  }
  if (hasChildren) {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  return matchPath({ path: item.to, end: true }, pathname) != null;
}

const STORAGE_KEY = 'admin-sidebar-collapsed';
const NAV_GROUPS_KEY = 'admin-sidebar-nav-groups';

function loadNavGroupOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_GROUPS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p != null && typeof p === 'object' && !Array.isArray(p)) {
      return p as Record<string, boolean>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function AdminSidebar() {
  const { pathname } = useLocation();
  const [navGroupOpen, setNavGroupOpen] = useState<Record<string, boolean>>(loadNavGroupOpen);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const isNavGroupExpanded = useCallback(
    (itemTo: string) => navGroupOpen[itemTo] !== false,
    [navGroupOpen]
  );

  const toggleNavGroup = useCallback((itemTo: string) => {
    setNavGroupOpen((prev) => {
      const expanded = prev[itemTo] !== false;
      const next = { ...prev, [itemTo]: !expanded };
      try {
        localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={clsx(
        'admin-portal flex h-screen shrink-0 flex-col border-r transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        'border-[var(--bg-border)] bg-[var(--bg-base)]',
        collapsed ? 'w-[var(--sidebar-collapsed-w)]' : 'w-[var(--sidebar-w)]'
      )}
    >
      <div
        className={clsx(
          'flex h-16 items-center border-b border-[var(--bg-border)] px-3',
          collapsed ? 'justify-center' : 'justify-between gap-2'
        )}
      >
        <div className={clsx('flex min-w-0 items-center gap-2', collapsed && 'justify-center')}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">
            EA
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-admin-heading)] text-base font-bold text-[var(--text-primary)]">
                Ecomx-admin
              </p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Admin
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
          className={clsx(
            'rounded-md p-2 text-[var(--text-secondary)] transition-colors',
            'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {adminNavSections.map((section) => {
          // Lọc item user có quyền xem
          const visibleItems = section.items.filter(
            (item) => !item.visibilityCheck || item.visibilityCheck(),
          );
          // Ẩn cả section nếu không còn item nào visible
          if (visibleItems.length === 0) return null;
          return (
          <div key={section.id} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {visibleItems.map((item) => {
                const hasChildren = Boolean(item.children?.length);
                const subExpanded = hasChildren && !collapsed && isNavGroupExpanded(item.to);
                const rowActive = sidebarItemRowActive(pathname, item);

                return (
                  <li key={item.to}>
                    {hasChildren && !collapsed ? (
                      <div
                        className={clsx(
                          'flex min-w-0 flex-nowrap items-stretch rounded-lg border-l-[3px] transition-colors',
                          rowActive
                            ? 'border-l-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-l-transparent hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <NavLink
                          to={item.to}
                          end={hasChildren}
                          className={clsx(
                            'flex min-w-0 flex-1 items-center gap-3 py-2 ps-3 pe-1 text-sm font-medium transition-colors',
                            'border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                            rowActive
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          <item.icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.badge ? (
                            <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                              {item.badge}
                            </span>
                          ) : null}
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => toggleNavGroup(item.to)}
                          aria-expanded={subExpanded}
                          aria-controls={`admin-nav-sub-${item.to.replace(/\//g, '-')}`}
                          title={subExpanded ? 'Thu gọn mục con' : 'Mở rộng mục con'}
                          className={clsx(
                            'flex w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)]',
                            'hover:bg-[var(--bg-elevated)]/90 hover:text-[var(--text-primary)]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                            rowActive && 'text-[var(--text-secondary)]'
                          )}
                        >
                          <ChevronRight
                            className={clsx('size-4 transition-transform duration-200', subExpanded && 'rotate-90')}
                            aria-hidden
                          />
                        </button>
                      </div>
                    ) : (
                      <NavLink
                        to={item.to}
                        end={item.to === '/admin' || hasChildren}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          clsx(
                            'flex min-w-0 items-center gap-3 rounded-lg py-2 pe-2 ps-3 text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                            isActive
                              ? 'border-l-[3px] border-l-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                              : 'border-l-[3px] border-l-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                            collapsed && 'justify-center px-0'
                          )
                        }
                      >
                        <item.icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.badge ? (
                          <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                            {item.badge}
                          </span>
                        ) : null}
                      </NavLink>
                    )}
                    {hasChildren && !collapsed && subExpanded ? (
                      <ul
                        id={`admin-nav-sub-${item.to.replace(/\//g, '-')}`}
                        className="ms-3 mt-0.5 space-y-0.5 border-l border-[var(--bg-border)] py-0.5 ps-3"
                      >
                        {item.children!.map((child) => (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              className={({ isActive }) =>
                                clsx(
                                  'block rounded-md py-1.5 pe-2 ps-2 text-[13px] font-medium transition-colors',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                                  isActive
                                    ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                                )
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--bg-border)] p-2">
        <button
          type="button"
          onClick={toggle}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-[var(--text-muted)]',
            'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed && <span>Thu gọn</span>}
        </button>
      </div>
    </aside>
  );
}

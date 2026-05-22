import { Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useQueries } from '@tanstack/react-query';
import { adminProductService } from '../../api/services/adminProductService';
import { adminCustomerService } from '../../api/services/adminStaffEmployeeService';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5',
        'shadow-[var(--card-shadow)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 font-[family-name:var(--font-admin-heading)] text-2xl font-bold text-[var(--text-primary)]">
            {value}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.trunc(n).toLocaleString('vi-VN');
}

export default function AdminDashboardPage() {
  const [productsQ, customersQ] = useQueries({
    queries: [
      {
        queryKey: ['admin-dashboard', 'products-total'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const { metadata } = await adminProductService.list({ page: 0, limit: 1, signal });
          return metadata?.totalElements;
        },
        staleTime: 60_000,
      },
      {
        queryKey: ['admin-dashboard', 'customers-total'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const { totalElements } = await adminCustomerService.listPaged(0, 1, signal);
          return totalElements;
        },
        staleTime: 60_000,
      },
    ],
  });

  const productsTotal =
    productsQ.isSuccess && productsQ.data != null ? productsQ.data : productsQ.isError ? null : undefined;
  const customersTotal =
    customersQ.isSuccess && customersQ.data != null
      ? customersQ.data
      : customersQ.isError
        ? null
        : undefined;

  const productsValue = productsQ.isPending ? '…' : formatCount(productsTotal);
  const customersValue = customersQ.isPending ? '…' : formatCount(customersTotal);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-admin-heading)] text-xl font-semibold text-[var(--text-primary)]">
          Tổng quan
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Doanh thu" value="—" icon={TrendingUp} />
        <StatCard label="Đơn hàng" value="—" icon={ShoppingCart} />
        <StatCard label="Sản phẩm" value={productsValue} icon={Package} />
        <StatCard label="Khách hàng" value={customersValue} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={clsx(
            'min-h-[280px] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5',
            'shadow-[var(--card-shadow)]'
          )}
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Biểu đồ doanh thu (30 ngày)</h2>
        </div>
        <div
          className={clsx(
            'min-h-[280px] rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-5',
            'shadow-[var(--card-shadow)]'
          )}
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Đơn theo trạng thái</h2>
        </div>
      </div>
    </div>
  );
}

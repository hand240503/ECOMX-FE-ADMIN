import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useParams,
} from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';
import AuthGuard from '../guards/AuthGuard';
import ProtectedRoute from '../guards/ProtectedRoute';
import { useAuth } from '../auth/AuthProvider';
import AppLoading from '../../components/AppLoading';
import { AdminLayout } from '../../admin/layout/AdminLayout';
import { AdminPricingLayout } from '../../admin/layout/AdminPricingLayout';
import AdminLoginPage from '../../admin/pages/AdminLoginPage';
import AdminDashboardPage from '../../admin/pages/AdminDashboardPage';
import AdminPlaceholderPage from '../../admin/pages/AdminPlaceholderPage';
import AdminProductFormPage from '../../admin/pages/AdminProductFormPage';
import AdminProductsPage from '../../admin/pages/AdminProductsPage';
import AdminProductsCuratedPage from '../../admin/pages/AdminProductsCuratedPage';
import AdminMixAndMatchPage from '../../admin/pages/AdminMixAndMatchPage';
import AdminPurchaseWithPurchasePage from '../../admin/pages/AdminPurchaseWithPurchasePage';
import AdminPriceChangesPage from '../../admin/pages/AdminPriceChangesPage';
import AdminProductCatalogPricesPage from '../../admin/pages/AdminProductCatalogPricesPage';
import AdminUnitsPage from '../../admin/pages/AdminUnitsPage';
import AdminBrandsPage from '../../admin/pages/AdminBrandsPage';
import AdminCategoriesPage from '../../admin/pages/AdminCategoriesPage';
import AdminPersonnelListPage from '../../admin/pages/AdminPersonnelListPage';
import AdminPersonnelFormPage from '../../admin/pages/AdminPersonnelFormPage';
import AdminRolesPage from '../../admin/pages/AdminRolesPage';
import AdminOrdersPage from '../../admin/pages/AdminOrdersPage';
import AdminOrderDetailPage from '../../admin/pages/AdminOrderDetailPage';
function AppRootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

function RedirectLegacyUserEdit() {
  const { userId } = useParams<{ userId: string }>();
  return <Navigate to={`/admin/staff/${userId}/edit`} replace />;
}

function RootRedirect() {
  const { status } = useAuth();

  if (status === 'unknown') {
    return (
      <AppLoading fullScreen title="Đang tải" subtitle="Đang kiểm tra phiên đăng nhập admin." />
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<AppRootLayout />}>
      <Route index element={<RootRedirect />} />

      <Route
        path="login"
        element={
          <AuthGuard>
            <AdminLoginPage />
          </AuthGuard>
        }
      />

      <Route
        path="admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="products/create" element={<AdminProductFormPage />} />
        <Route path="products/featured" element={<AdminProductsCuratedPage kind="featured" />} />
        <Route path="products/hot-sale" element={<AdminProductsCuratedPage kind="hot-sale" />} />
        <Route path="products/mix-and-match" element={<Navigate to="/admin/pricing/volume" replace />} />
        <Route
          path="products/purchase-with-purchase"
          element={<Navigate to="/admin/pricing/pwp" replace />}
        />

        {/* Pricing module (PRICING-UI.md) — sub-sidebar layout */}
        <Route path="pricing" element={<AdminPricingLayout />}>
          <Route index element={<Navigate to="/admin/pricing/catalog" replace />} />
          <Route path="catalog" element={<AdminProductCatalogPricesPage />} />
          <Route path="time-change" element={<AdminPriceChangesPage />} />
          <Route path="volume" element={<AdminMixAndMatchPage />} />
          <Route path="pwp" element={<AdminPurchaseWithPurchasePage />} />
          <Route path="units" element={<AdminUnitsPage />} />
        </Route>

        {/* Legacy redirects /admin/price/* → /admin/pricing/* */}
        <Route path="price" element={<Navigate to="/admin/pricing/catalog" replace />} />
        <Route path="price/catalog" element={<Navigate to="/admin/pricing/catalog" replace />} />
        <Route path="price/price-changes" element={<Navigate to="/admin/pricing/time-change" replace />} />
        <Route path="price/mix-and-match" element={<Navigate to="/admin/pricing/volume" replace />} />
        <Route path="price/purchase-with-purchase" element={<Navigate to="/admin/pricing/pwp" replace />} />
        <Route path="products/:productId/edit" element={<AdminProductFormPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="brands" element={<AdminBrandsPage />} />
        <Route path="orders" element={<Outlet />}>
          <Route index element={<AdminOrdersPage />} />
          <Route path=":orderId" element={<AdminOrderDetailPage />} />
        </Route>
        <Route
          path="warehouse"
          element={
            <AdminPlaceholderPage
              title="Kho"
              description="Quản lý tồn kho và phiếu kho."
              badge="Coming soon"
            />
          }
        />
        <Route path="staff" element={<AdminPersonnelListPage variant="staff" />} />
        <Route path="staff/create" element={<AdminPersonnelFormPage variant="staff" />} />
        <Route path="staff/:userId/edit" element={<AdminPersonnelFormPage variant="staff" />} />
        <Route path="employees" element={<AdminPersonnelListPage variant="employee" />} />
        <Route path="employees/create" element={<AdminPersonnelFormPage variant="employee" />} />
        <Route path="employees/:userId/edit" element={<AdminPersonnelFormPage variant="employee" />} />
        <Route path="customers" element={<AdminPersonnelListPage variant="customer" />} />
        <Route path="customers/create" element={<Navigate to="/admin/customers" replace />} />
        <Route path="customers/:userId/edit" element={<AdminPersonnelFormPage variant="customer" />} />
        <Route path="users" element={<Navigate to="/admin/staff" replace />} />
        <Route path="users/create" element={<Navigate to="/admin/staff/create" replace />} />
        <Route path="users/:userId/edit" element={<RedirectLegacyUserEdit />} />
        <Route path="roles" element={<AdminRolesPage />} />
        <Route
          path="documents"
          element={<AdminPlaceholderPage title="Tài liệu / Upload" description="Tải lên và quản lý tài liệu." />}
        />
        <Route
          path="reports"
          element={<AdminPlaceholderPage title="Báo cáo công việc" description="Báo cáo và thống kê." />}
        />
        <Route
          path="settings"
          element={
            <AdminPlaceholderPage title="Cấu hình hệ thống" description="Thiết lập hệ thống." badge="Future" />
          }
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Route>
  )
);

const AppRoutes = () => {
  return <RouterProvider router={router} />;
};

export default AppRoutes;

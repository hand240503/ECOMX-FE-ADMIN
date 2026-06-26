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
import AdminCatalogImportPage from '../../admin/pages/AdminCatalogImportPage';
import AdminPersonnelListPage from '../../admin/pages/AdminPersonnelListPage';
import AdminPersonnelFormPage from '../../admin/pages/AdminPersonnelFormPage';
import AdminStaffFormPage from '../../admin/pages/AdminStaffFormPage';
import AdminRolesPage from '../../admin/pages/AdminRolesPage';
import AdminOrdersPage from '../../admin/pages/AdminOrdersPage';
import AdminOrderDetailPage from '../../admin/pages/AdminOrderDetailPage';
import AdminHistoryPage from '../../admin/pages/AdminHistoryPage';
import AdminReturnOrdersPage from '../../admin/pages/AdminReturnOrdersPage';
import AdminReturnDetailPage from '../../admin/pages/AdminReturnDetailPage';
import AdminWarehousePage from '../../admin/pages/AdminWarehousePage';
import AdminStoresPage from '../../admin/pages/AdminStoresPage';
import AdminDepartmentListPage from '../../admin/pages/AdminDepartmentListPage';
import AdminDepartmentFormPage from '../../admin/pages/AdminDepartmentFormPage';
import ReportDashboardPage from '../../admin/pages/ReportDashboardPage';
import ReportTopProductsPage from '../../admin/pages/ReportTopProductsPage';
import AdminRecommendationInsightsPage from '../../admin/pages/AdminRecommendationInsightsPage';
import AdminProfilePage from '../../admin/pages/AdminProfilePage';
import { PermissionGate } from '../guards/PermissionGate';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
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
        <Route
          path="products"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminProductsPage />
            </PermissionGate>
          }
        />
        <Route
          path="products/create"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminProductFormPage />
            </PermissionGate>
          }
        />
        <Route
          path="products/featured"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminProductsCuratedPage kind="featured" />
            </PermissionGate>
          }
        />
        <Route
          path="products/hot-sale"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminProductsCuratedPage kind="hot-sale" />
            </PermissionGate>
          }
        />
        <Route path="products/mix-and-match" element={<Navigate to="/admin/pricing/volume" replace />} />
        <Route
          path="products/purchase-with-purchase"
          element={<Navigate to="/admin/pricing/pwp" replace />}
        />

        {/* Pricing module (PRICING-UI.md) — sub-sidebar layout */}
        <Route
          path="pricing"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewPricing}>
              <AdminPricingLayout />
            </PermissionGate>
          }
        >
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

        <Route
          path="products/:productId/edit"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminProductFormPage />
            </PermissionGate>
          }
        />
        <Route
          path="categories"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewCategories}>
              <AdminCategoriesPage />
            </PermissionGate>
          }
        />
        <Route
          path="categories/import"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewCategories}>
              <AdminCatalogImportPage kind="category" />
            </PermissionGate>
          }
        />
        <Route
          path="brands"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewBrands}>
              <AdminBrandsPage />
            </PermissionGate>
          }
        />
        <Route
          path="brands/import"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewBrands}>
              <AdminCatalogImportPage kind="brand" />
            </PermissionGate>
          }
        />

        {/* Route "tasks" (Quản lý công việc) đã được ẩn khỏi giao diện. */}

        <Route
          path="orders"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewOrders}>
              <Outlet />
            </PermissionGate>
          }
        >
          <Route index element={<AdminOrdersPage />} />
          <Route path=":orderId" element={<AdminOrderDetailPage />} />
        </Route>

        <Route
          path="returns"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewOrders}>
              <Outlet />
            </PermissionGate>
          }
        >
          <Route index element={<AdminReturnOrdersPage />} />
          <Route path=":orderId" element={<AdminReturnDetailPage />} />
        </Route>

        <Route
          path="warehouse"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewStores}>
              <AdminWarehousePage />
            </PermissionGate>
          }
        />

        <Route
          path="stores"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewStores}>
              <AdminStoresPage />
            </PermissionGate>
          }
        />

        {/* Nhân sự & User */}
        <Route
          path="staff"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewUsers}>
              <AdminPersonnelListPage variant="staff" />
            </PermissionGate>
          }
        />
        <Route
          path="staff/create"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewUsers}>
              <AdminStaffFormPage />
            </PermissionGate>
          }
        />
        <Route
          path="staff/:userId/edit"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewUsers}>
              <AdminStaffFormPage />
            </PermissionGate>
          }
        />
        <Route path="employees" element={<Navigate to="/admin/staff" replace />} />
        <Route path="employees/create" element={<Navigate to="/admin/staff/create" replace />} />
        <Route path="employees/:userId/edit" element={<Navigate to="/admin/staff" replace />} />
        <Route
          path="customers"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewUsers}>
              <AdminPersonnelListPage variant="customer" />
            </PermissionGate>
          }
        />
        <Route path="customers/create" element={<Navigate to="/admin/customers" replace />} />
        <Route
          path="customers/:userId/edit"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewUsers}>
              <AdminPersonnelFormPage variant="customer" />
            </PermissionGate>
          }
        />
        <Route path="users" element={<Navigate to="/admin/staff" replace />} />
        <Route path="users/create" element={<Navigate to="/admin/staff/create" replace />} />
        <Route path="users/:userId/edit" element={<RedirectLegacyUserEdit />} />

        <Route
          path="roles"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewRoles}>
              <AdminRolesPage />
            </PermissionGate>
          }
        />

        {/* ── Phòng ban (Department) ───────────────────────────────────── */}
        <Route
          path="departments"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewDepartments}>
              <AdminDepartmentListPage />
            </PermissionGate>
          }
        />
        <Route
          path="departments/create"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewDepartments}>
              <AdminDepartmentFormPage />
            </PermissionGate>
          }
        />
        <Route
          path="departments/:deptId/edit"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewDepartments}>
              <AdminDepartmentFormPage />
            </PermissionGate>
          }
        />
        <Route
          path="departments/:deptId/members"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewDepartments}>
              <AdminDepartmentFormPage />
            </PermissionGate>
          }
        />

        <Route
          path="history"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewHistory}>
              <AdminHistoryPage />
            </PermissionGate>
          }
        />
        <Route
          path="documents"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewDocuments}>
              <AdminPlaceholderPage title="Tài liệu / Upload" description="Tải lên và quản lý tài liệu." />
            </PermissionGate>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewReports}>
              <ReportDashboardPage />
            </PermissionGate>
          }
        />
        <Route
          path="reports/top-products"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewReports}>
              <ReportTopProductsPage />
            </PermissionGate>
          }
        />
        <Route
          path="recommendation-insights"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewProducts}>
              <AdminRecommendationInsightsPage />
            </PermissionGate>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionGate canView={adminAccessControlUi.canViewSettings}>
              <AdminPlaceholderPage title="Cấu hình hệ thống" description="Thiết lập hệ thống." badge="Future" />
            </PermissionGate>
          }
        />
        <Route path="profile" element={<AdminProfilePage />} />
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

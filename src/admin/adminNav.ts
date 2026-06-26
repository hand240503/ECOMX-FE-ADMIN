import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Building2,
  ClipboardList,
  CircleDollarSign,
  FileStack,
  FolderTree,
  History,
  LayoutDashboard,
  Package,
  PackageX,
  Sparkles,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Users,
  Warehouse,
} from 'lucide-react';
import { adminAccessControlUi } from '../lib/adminAccessControlUi';

export type AdminNavChildItem = {
  to: string;
  label: string;
};

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  children?: AdminNavChildItem[];
  /**
   * Hàm kiểm tra quyền xem. Trả về false → ẩn item khỏi sidebar.
   * Không định nghĩa → luôn hiển thị.
   */
  visibilityCheck?: () => boolean;
};

export type AdminNavSection = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    id: 'overview',
    title: 'Tổng quan',
    items: [
      {
        to: '/admin',
        label: 'Tổng quan',
        icon: LayoutDashboard,

      },
      // Quản lý công việc (task) đã được ẩn khỏi giao diện.
    ],
  },
  {
    id: 'catalog',
    title: 'Danh mục sản phẩm',
    items: [
      {
        to: '/admin/products',
        label: 'Sản phẩm',
        icon: Package,
        visibilityCheck: () => adminAccessControlUi.canViewProducts(),
        children: [
          { to: '/admin/products/featured', label: 'Nổi bật' },
          { to: '/admin/products/hot-sale', label: 'Bán chạy' },
        ],
      },
      {
        to: '/admin/categories',
        label: 'Danh mục',
        icon: FolderTree,
        visibilityCheck: () => adminAccessControlUi.canViewCategories(),
      },
      {
        to: '/admin/brands',
        label: 'Hãng / Thương hiệu',
        icon: Award,
        visibilityCheck: () => adminAccessControlUi.canViewBrands(),
      },
    ],
  },
  {
    id: 'price',
    title: 'Giá cả',
    items: [
      {
        to: '/admin/pricing',
        label: 'Giá & khuyến mãi',
        icon: CircleDollarSign,
        visibilityCheck: () => adminAccessControlUi.canViewPricing(),
        children: [
          { to: '/admin/pricing/catalog', label: 'Giá niêm yết (catalog)' },
          { to: '/admin/pricing/time-change', label: 'Giá theo khung thời gian' },
          { to: '/admin/pricing/volume', label: 'Giá theo bậc số lượng (volume)' },
          { to: '/admin/pricing/pwp', label: 'Chương trình mua kèm (PwP)' },
          { to: '/admin/pricing/units', label: 'Đơn vị tính' },
        ],
      },
    ],
  },
  {
    id: 'ops',
    title: 'Vận hành',
    items: [
      {
        to: '/admin/orders',
        label: 'Đơn hàng',
        icon: ShoppingCart,
        badge: '—',
        visibilityCheck: () => adminAccessControlUi.canViewOrders(),
      },
      {
        to: '/admin/returns',
        label: 'Trả hàng / Hoàn tiền',
        icon: PackageX,
        visibilityCheck: () => adminAccessControlUi.canViewOrders(),
      },
      {
        to: '/admin/warehouse',
        label: 'Kho',
        icon: Warehouse,
        visibilityCheck: () => adminAccessControlUi.canViewStores(),
      },
      {
        to: '/admin/stores',
        label: 'Cửa hàng (bản đồ)',
        icon: Store,
        visibilityCheck: () => adminAccessControlUi.canViewStores(),
      },
      {
        to: '/admin/history',
        label: 'Lịch sử hệ thống',
        icon: History,
        visibilityCheck: () => adminAccessControlUi.canViewHistory(),
      },
    ],
  },
  {
    id: 'people',
    title: 'Nhân sự & Người dùng',
    items: [
      {
        to: '/admin/staff',
        label: 'Nhân sự',
        icon: Users,
        visibilityCheck: () => adminAccessControlUi.canViewUsers(),
        children: [
          { to: '/admin/staff', label: 'Nhân viên' },
          { to: '/admin/customers', label: 'Khách hàng' },
        ],
      },
      {
        to: '/admin/roles',
        label: 'Chức vụ',
        icon: Shield,
        visibilityCheck: () => adminAccessControlUi.canViewRoles(),
      },
      {
        to: '/admin/departments',
        label: 'Phòng ban',
        icon: Building2,
        visibilityCheck: () => adminAccessControlUi.canViewDepartments(),
      },
    ],
  },
  {
    id: 'content',
    title: 'Nội dung',
    items: [
      {
        to: '/admin/documents',
        label: 'Tài liệu',
        icon: FileStack,
        // Hidden by request. Restore: visibilityCheck: () => adminAccessControlUi.canViewDocuments(),
        visibilityCheck: () => false,
      },
      {
        to: '/admin/reports',
        label: 'Báo cáo',
        icon: ClipboardList,
        visibilityCheck: () => adminAccessControlUi.canViewReports(),
      },
      {
        to: '/admin/recommendation-insights',
        label: 'Phân tích gợi ý',
        icon: Sparkles,
        visibilityCheck: () => adminAccessControlUi.canViewProducts(),
      },
    ],
  },
  {
    id: 'system',
    title: 'Cài đặt',
    items: [
      {
        to: '/admin/settings',
        label: 'Cấu hình hệ thống',
        icon: Settings,
        // Hidden by request (also hides the "Cài đặt" section). Restore: visibilityCheck: () => adminAccessControlUi.canViewSettings(),
        visibilityCheck: () => false,
      },
    ],
  },
];

import type { LucideIcon } from 'lucide-react';
import {
  Award,
  ClipboardList,
  CircleDollarSign,
  FileStack,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';

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
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'catalog',
    title: 'Catalog',
    items: [
      {
        to: '/admin/products',
        label: 'Sản phẩm',
        icon: Package,
        children: [
          { to: '/admin/products/featured', label: 'Nổi bật' },
          { to: '/admin/products/hot-sale', label: 'Hot-sale' },
        ],
      },
      { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
      { to: '/admin/brands', label: 'Hãng / Thương hiệu', icon: Award },
    ],
  },
  {
    id: 'price',
    title: 'PRICE',
    items: [
      {
        to: '/admin/pricing',
        label: 'Giá & khuyến mãi',
        icon: CircleDollarSign,
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
      { to: '/admin/orders', label: 'Đơn hàng', icon: ShoppingCart, badge: '—' },
      { to: '/admin/warehouse', label: 'Kho', icon: Warehouse },
    ],
  },
  {
    id: 'people',
    title: 'Nhân sự & User',
    items: [
      {
        to: '/admin/staff',
        label: 'Nhân sự',
        icon: Users,
        children: [
          { to: '/admin/staff', label: 'Nội bộ (Staff)' },
          { to: '/admin/employees', label: 'Nhân viên (EMPLOYEE)' },
          { to: '/admin/customers', label: 'Khách hàng' },
        ],
      },
      { to: '/admin/roles', label: 'Chức vụ (Role)', icon: Shield },
    ],
  },
  {
    id: 'content',
    title: 'Nội dung',
    items: [
      { to: '/admin/documents', label: 'Tài liệu', icon: FileStack },
      { to: '/admin/reports', label: 'Báo cáo', icon: ClipboardList },
    ],
  },
  {
    id: 'system',
    title: 'Cài đặt',
    items: [{ to: '/admin/settings', label: 'Cấu hình hệ thống', icon: Settings }],
  },
];

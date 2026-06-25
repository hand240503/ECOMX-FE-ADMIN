export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/admin/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    VERIFY_EMAIL: '/auth/otp/verify',
    SEND_OTP: '/auth/otp/send',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password'
  },

  USER: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    CHANGE_PASSWORD: '/users/profile/password',
    CHANGE_CONTACT: '/users/profile/contact',
    /** @see docs/API_user_address.md */
    ADDRESSES: '/users/addresses',
    ADDRESS_BY_ID: (id: number | string) => `/users/addresses/${id}`,
    ADDRESS_SET_DEFAULT: (id: number | string) => `/users/addresses/${id}/default`,
  },

  PRODUCT: {
    LIST: '/products',
    DETAIL: (id: string) => `/products/${id}`,
    /** `GET` — `ProductDetailResponse` (product + recommendations). @see docs/product_api.md */
    DETAIL_WITH_RECOMMENDATIONS: (id: number | string) => `/products/${id}/detail`,
    /** @see docs/api_search.md §1 */
    SEARCH: '/products/search',
    /**
     * Danh sách SP theo phạm vi danh mục (categoryId + toàn bộ descendant), phân trang `page`/`limit`.
     * JWT. Chi tiết: docs/product-by-category.md — bước 4 luồng: docs/home-category-product-list-flow.md
     */
    BY_CATEGORY: (categoryId: number | string) => `/products/category/${categoryId}`,
    /**
     * `POST` body `{ productIds: number[] }` — tối đa 200 id; trả về `ProductFullResponse[]` theo thứ tự gửi.
     * @see docs/API_products_by_ids_FE.md
     */
    BY_IDS: '/products/by-ids',
    /**
     * Backend cũng có variant query string: `GET /products/by-ids?ids=1,2,3` (FE hiện chưa dùng).
     * FE chỉ khai báo path, phần `?ids=` sẽ được build từ service nếu cần.
     */
    BY_IDS_QUERY: '/products/by-ids',
    /** `GET ?limit=&all=` — `is_featured` / `hot_sale`. @see docs/FRONTEND_PRODUCT_FEATURED_HOT_SALE.md */
    IS_FEATURED: '/products/is-featured',
    HOT_SALE: '/products/hot-sale',
    /** Backend có nhưng FE hiện chưa dùng */
    FEATURED: '/products/featured',
    /** Backend có nhưng FE hiện chưa dùng */
    BEST_SELLERS: '/products/best-sellers',
  },

  RECOMMENDATIONS: {
    /** Trả JSON array thẳng (không bọc APIResponse) — xem docs/api_home.md */
    HOME: '/recommendations/home',
    /**
     * `GET` — `ProductFullResponse[]` (không envelope). Gợi ý theo 1 sản phẩm nguồn (CF+content hybrid).
     * @see docs/API_recommendation_item_hybrid_FE.md
     */
    ITEM_HYBRID: (productId: number | string) => `/recommendations/item-hybrid/${productId}`,
    /** Backend có nhưng FE hiện chưa dùng */
    PDP: (productId: number | string) => `/recommendations/pdp/${productId}`,
    /** Backend có nhưng FE hiện chưa dùng */
    POST_PURCHASE: (productId: number | string) => `/recommendations/post-purchase/${productId}`,
    /** Backend có nhưng FE hiện chưa dùng */
    SESSION: '/recommendations/session',
  },

  /**
   * Cần JWT. Hợp đồng: docs/category.md.
   * Thứ tự gọi trên trang danh mục: docs/home-category-product-list-flow.md (bước 2–3).
   */
  CATEGORY: {
    LIST: '/categories',
    ROOTS: '/categories/roots',
    CHILDREN: (parentId: number | string) => `/categories/parent/${parentId}/children`,
    BY_ID: (id: number | string) => `/categories/${id}`,
  },

  /** @see docs/api_search.md §2 */
  SEARCH: {
    TRENDING: '/search/trending',
  },

  /** @see docs/API_add_order.md */
  ORDER: {
    PAYMENT_METHODS: '/payment-methods',
    CREATE: '/orders',
    LIST: '/orders',
    BY_ID: (id: number | string) => `/orders/${id}`,
    CANCEL: (id: number | string) => `/orders/${id}/cancel`,
    RETURN_REQUEST: (id: number | string) => `/orders/${id}/return-request`,
    /** Backend có nhưng FE hiện chưa dùng */
    CONFIRM_PAYMENT: (id: number | string) => `/orders/${id}/confirm-payment`,
    /** @see docs/VNPAY_CHECKOUT_SESSIONS_FE_GUIDE.md */
    VNPAY_PENDING: (transactionPublicId: string) => `/orders/vnpay-pending/${transactionPublicId}`,
    VNPAY_PENDING_TRANSACTION_STATUS: (transactionPublicId: string) =>
      `/orders/vnpay-pending/${transactionPublicId}/transaction-status`,
    VNPAY_ABANDON: (transactionPublicId: string) => `/orders/vnpay-pending/${transactionPublicId}/abandon`,
    /**
     * Dev: mô phỏng IPN thành công khi IPN không tới localhost — JWT, không body; BE bật `vnpay.dev-simulate-success-enabled`.
     * @see docs/VNPAY_CHECKOUT_SESSIONS_FE_GUIDE.md §4
     */
    VNPAY_DEV_SIMULATE_SUCCESS: (transactionPublicId: string) =>
      `/orders/vnpay-pending/${transactionPublicId}/dev-simulate-success`,
  },

  VNPAY: {
    CHECKOUT_SESSION_PAYMENT_URL: (checkoutSessionId: number | string) =>
      `/payment/vnpay/checkout-sessions/${checkoutSessionId}/payment-url`,
  },

  /** @see docs/API_SHIPPING_AND_ORDERS_UPDATE.md §1 */
  SHIPPING: {
    DISTANCE_TO_WAREHOUSE: '/shipping/distance-to-warehouse',
  },

  /** @see docs/COLLECTOR_LOG_API.md */
  COLLECTOR_LOGS: '/collector-logs',
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_BY_ID: (id: number | string) => `/collector-logs/${id}`,
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_BY_USER: (userId: number | string) => `/collector-logs/user/${userId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_BY_PRODUCT: (productId: number | string) => `/collector-logs/product/${productId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_BY_EVENT: (event: string) => `/collector-logs/event/${event}`,
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_BY_SESSION: (sessionId: string) => `/collector-logs/session/${sessionId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_DATE_RANGE: '/collector-logs/date-range',
  /** Backend có nhưng FE hiện chưa dùng */
  COLLECTOR_LOGS_FILTER: '/collector-logs/filter',

  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS: '/user-ratings',
  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS_BY_ID: (id: number | string) => `/user-ratings/${id}`,
  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS_BY_USER_PRODUCT: (userId: number | string, productId: number | string) =>
    `/user-ratings/user/${userId}/product/${productId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS_BY_USER: (userId: number | string) => `/user-ratings/user/${userId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS_BY_PRODUCT: (productId: number | string) => `/user-ratings/product/${productId}`,
  /** Backend có nhưng FE hiện chưa dùng */
  USER_RATINGS_PRODUCT_AVERAGE: (productId: number | string) => `/user-ratings/product/${productId}/average`,

  /**
   * JWT admin (EMPLOYEE+). @see docs/PRODUCT_CRUD_MEDIA.md
   */
  ADMIN: {
    USERS: '/admin/users',
    USER_BY_ID: (id: number | string) => `/admin/users/${id}`,
    /** @see docs/ADMIN_STAFF_CUSTOMERS_API_FE.md */
    STAFF: '/admin/staff',
    STAFF_BY_ID: (id: number | string) => `/admin/staff/${id}`,
    EMPLOYEES: '/admin/employees',
    EMPLOYEE_BY_ID: (id: number | string) => `/admin/employees/${id}`,
    CUSTOMERS: '/admin/customers',
    CUSTOMER_BY_ID: (id: number | string) => `/admin/customers/${id}`,
    STAFF_RESET_PASSWORD: (id: number | string) => `/admin/staff/${id}/reset-password`,
    /** Import/upsert nhan vien noi bo tu Excel/CSV/TXT (multipart `file`) + tai file mau */
    STAFF_IMPORT: '/admin/staff/import',
    STAFF_IMPORT_TEMPLATE: '/admin/staff/import/template',
    PRODUCTS: '/admin/products',
    PRODUCT_BY_ID: (id: number | string) => `/admin/products/${id}`,
    // Import / export sản phẩm
    PRODUCTS_IMPORT: '/admin/products/import',
    PRODUCTS_IMPORT_PREVIEW: '/admin/products/import/preview',
    PRODUCTS_IMPORT_TEMPLATE: '/admin/products/import/template',
    // Import biến thể (phân loại) cho MỘT sản phẩm (trang chi tiết)
    PRODUCT_VARIANT_IMPORT: (productId: number | string) => `/admin/products/${productId}/variants/import`,
    PRODUCT_VARIANT_IMPORT_PREVIEW: (productId: number | string) =>
      `/admin/products/${productId}/variants/import/preview`,
    PRODUCT_VARIANT_IMPORT_TEMPLATE: (productId: number | string) =>
      `/admin/products/${productId}/variants/import/template`,
    PRODUCTS_EXPORT: '/admin/products/export',
    PRODUCTS_EXPORT_INCOMPLETE: '/admin/products/export/incomplete',
    // Cổng ẩn: xác thực mật khẩu super admin trước khi xuất toàn bộ sản phẩm
    PRODUCTS_VERIFY_SUPER_ADMIN: '/admin/products/verify-super-admin',
    // Đánh dấu nổi bật / hot-sale bằng Excel (multipart `file`) + tải file mẫu
    PRODUCTS_FEATURED_IMPORT: '/admin/products/featured/import',
    PRODUCTS_FEATURED_IMPORT_TEMPLATE: '/admin/products/featured/import/template',
    PRODUCTS_HOTSALE_IMPORT: '/admin/products/hot-sale/import',
    PRODUCTS_HOTSALE_IMPORT_TEMPLATE: '/admin/products/hot-sale/import/template',
    // Gán danh mục / thương hiệu hàng loạt bằng Excel (cột sku + brand_code + category_code) + tải file mẫu
    PRODUCTS_ASSIGN_CATALOG_IMPORT: '/admin/products/assign-catalog/import',
    PRODUCTS_ASSIGN_CATALOG_IMPORT_TEMPLATE: '/admin/products/assign-catalog/import/template',
    // Brand import / export
    BRANDS_EXPORT: '/admin/brands/export',
    BRANDS_IMPORT: '/admin/brands/import',
    BRANDS_IMPORT_PREVIEW: '/admin/brands/import/preview',
    // Category import / export
    CATEGORIES_EXPORT: '/admin/categories/export',
    CATEGORIES_IMPORT: '/admin/categories/import',
    CATEGORIES_IMPORT_PREVIEW: '/admin/categories/import/preview',
    CATEGORIES_BULK_DELETE: '/admin/categories/bulk-delete',
    // Inventory import
    INVENTORY_IMPORT_EXCEL: '/admin/inventory/import/excel',
    INVENTORY_IMPORT_TEMPLATE: '/admin/inventory/import/template',
    // Promotion import
    PROMO_PRICE_CHANGE_IMPORT: '/admin/promotions/price-changes/import',
    PROMO_PRICE_CHANGE_IMPORT_TEMPLATE: '/admin/promotions/price-changes/import/template',
    PROMO_PWP_IMPORT: '/admin/promotions/purchase-with-purchase/import',
    PROMO_PWP_IMPORT_TEMPLATE: '/admin/promotions/purchase-with-purchase/import/template',
    PROMO_VOLUME_TIER_IMPORT: '/admin/promotions/volume-price-tiers/import',
    PROMO_VOLUME_TIER_IMPORT_TEMPLATE: '/admin/promotions/volume-price-tiers/import/template',
    // Promotion overview — liệt kê tất cả sản phẩm đang chạy chương trình
    PROMO_PRICE_CHANGES_ALL: '/admin/promotions/price-changes',
    PROMO_VOLUME_TIERS_ALL: '/admin/promotions/volume-price-tiers',
    // Order: xóa media trả hàng
    ORDER_DELETE_RETURN_MEDIA: (id: number | string, mediaId: number | string) =>
      `/admin/orders/${id}/return-media/${mediaId}`,
    PRODUCTS_BY_CATEGORY: (categoryId: number | string) => `/admin/products/category/${categoryId}`,
    /** Daily product catalog prices (PriceEntity) */
    PRODUCT_PRICES: (productId: number | string) => `/admin/products/${productId}/prices`,
    PRODUCT_PRICE_BY_ID: (productId: number | string, priceId: number | string) =>
      `/admin/products/${productId}/prices/${priceId}`,
    /** Mix-and-match / volume pricing tiers */
    PRODUCT_VOLUME_PRICE_TIERS: (productId: number | string) =>
      `/admin/products/${productId}/volume-price-tiers`,
    /** Price change theo thời gian — BE chỉ map path có `/variants/{variantId}/` (không dùng `/products/{id}/price-changes` SPU). */
    PRODUCT_VARIANT_PRICE_CHANGES: (productId: number | string, variantId: number | string) =>
      `/admin/products/${productId}/variants/${variantId}/price-changes`,
    PRODUCT_VARIANT_PRICE_CHANGE_BY_ID: (
      productId: number | string,
      variantId: number | string,
      priceChangeId: number | string
    ) => `/admin/products/${productId}/variants/${variantId}/price-changes/${priceChangeId}`,
    /**
     * `POST multipart` — part `newImages` (≥1); query `mainNewImageIndex` (0-based trong lô).
     * @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4.1
     */
    PRODUCT_VARIANT_IMAGES: (productId: number | string, variantId: number | string) =>
      `/admin/products/${productId}/variants/${variantId}/images`,
    /** Purchase-with-purchase promotions */
    PWP_OFFERS: '/admin/promotions/purchase-with-purchase',
    PWP_OFFER_BY_ID: (id: number | string) => `/admin/promotions/purchase-with-purchase/${id}`,
    /** Unit catalog (đơn vị tính) — @see docs/ADMIN_UNITS.md */
    UNITS: '/admin/units',
    UNIT_BY_ID: (id: number | string) => `/admin/units/${id}`,
    /** Import/upsert don vi tinh tu Excel/CSV/TXT (multipart `file`) + tai file mau */
    UNITS_IMPORT: '/admin/units/import',
    UNITS_IMPORT_TEMPLATE: '/admin/units/import/template',
    /** Brand catalog (hãng / thương hiệu) — @see docs/ADMIN_BRANDS.md */
    BRANDS: '/admin/brands',
    BRAND_BY_ID: (id: number | string) => `/admin/brands/${id}`,
    BRANDS_BULK_DELETE: '/admin/brands/bulk-delete',
    /** Danh mục sản phẩm — @see docs/ADMIN_CATEGORIES.md */
    CATEGORIES: '/admin/categories',
    CATEGORY_BY_ID: (id: number | string) => `/admin/categories/${id}`,
    /** @see docs/ADMIN_USER_ROLE_PERMISSION_API_FE.md */
    ROLES: '/admin/roles',
    ROLE_BY_ID: (id: number | string) => `/admin/roles/${id}`,
    PERMISSIONS_CATALOG: '/admin/permissions/catalog',
    USER_PERMISSIONS: (userId: number | string) => `/admin/users/${userId}/permissions`,
    PERMISSIONS_GRANT: '/admin/users/permissions/grant',
    PERMISSIONS_REVOKE: '/admin/users/permissions/revoke',
    DOCUMENT_UPLOAD: '/admin/document/upload',
    /** POST — đặt document có id là ảnh đại diện (main) trong cùng entity */
    DOCUMENT_SET_MAIN: (id: number | string) => `/admin/document/${id}/main`,
    /** PUT multipart `file` — thay file ảnh, giữ id / entity / cờ main — @see docs/DOCUMENT_MEDIA_API_FE.md §4 */
    DOCUMENT_REPLACE: (id: number | string) => `/admin/document/${id}/replace`,
    /** DELETE — xóa document — @see docs/DOCUMENT_MEDIA_API_FE.md §3 */
    DOCUMENT_BY_ID: (id: number | string) => `/admin/document/${id}`,
    /** Department management — @see AdminDepartmentController */
    DEPARTMENTS: '/admin/departments',
    DEPARTMENT_BY_ID: (id: number | string) => `/admin/departments/${id}`,
    DEPARTMENT_ADD_MEMBER: (id: number | string, userId: number | string) => `/admin/departments/${id}/members/${userId}`,
    DEPARTMENT_REMOVE_MEMBER: (id: number | string, userId: number | string) => `/admin/departments/${id}/members/${userId}`,
    /** Admin order management — @see AdminOrderController */
    ORDERS: '/admin/orders',
    ORDER_BY_ID: (id: number | string) => `/admin/orders/${id}`,
    ORDER_UPDATE_STATUS: (id: number | string) => `/admin/orders/${id}/status`,
    ORDER_UPDATE_RETURN_STATUS: (id: number | string) => `/admin/orders/${id}/return-status`,
    /** Quản lý kho — @see AdminInventoryController */
    INVENTORY_STOCKS: '/admin/inventory/stocks',
    INVENTORY_VARIANT_STOCK: (variantId: number | string) => `/admin/inventory/variants/${variantId}`,
    INVENTORY_VARIANT_LEDGER: (variantId: number | string) => `/admin/inventory/variants/${variantId}/ledger`,
    INVENTORY_IMPORT: '/admin/inventory/import',
    INVENTORY_ADJUST: '/admin/inventory/adjust',
    /** History / audit log — @see AdminHistoryController */
    HISTORY: '/admin/history',
    HISTORY_ORDER: (orderId: number | string) => `/admin/history/orders/${orderId}`,
    HISTORY_ORDER_STATUS: (orderId: number | string) => `/admin/history/orders/${orderId}/status`,
    HISTORY_ORDER_RETURN: (orderId: number | string) => `/admin/history/orders/${orderId}/return-refund`,
    HISTORY_ACTIVITY: '/admin/history/activity',
    HISTORY_ACTIVITY_ENTITY: (type: string, id: number | string) => `/admin/history/activity/entity/${type}/${id}`,
    /** Lịch sử sự kiện chương trình giá — @see PriceEventHistoryResponse.java */
    HISTORY_PRICE_EVENTS: '/admin/history/price-events',
  },

  /** Backend có nhưng FE hiện chưa dùng */
  DOCUMENT: {
    UPLOAD: '/document/upload',
    BY_FILENAME: (filename: string) => `/document/${filename}`,
  },

  /** Backend có nhưng FE hiện chưa dùng */
  JOB: {
    ROOT: '/job',
    DETAILS: '/job/details',
  },
};

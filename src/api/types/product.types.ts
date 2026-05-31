export interface BrandSummary {
  id: number;
  code: string;
  name: string;
  status: number;
}

export interface CategorySummary {
  id: number;
  code: string;
  name: string;
  status: number;
  parentId: number | null;
}

/** Snapshot phân loại đi kèm từng dòng giá (GET `/admin/products/.../prices`). */
export interface ProductVariantPriceRef {
  id: number;
  skuCode?: string | null;
  optionValues?: Record<string, string> | null;
  active?: boolean;
  sortOrder?: number;
}

export interface ProductPrice {
  id: number;
  currentValue: number;
  oldValue: number | null;
  unitId: number;
  unitName: string;
  unitRatio: number;
  /** Tên hiển thị tuỳ chỉnh (ví dụ: "Hộp 6 chiếc"). BE trả `display_name`. */
  displayName?: string | null;
  /** Khớp BE: `product_variant_id` — giá gắn SKU */
  productVariantId?: number | null;
  variant?: ProductVariantPriceRef | null;
}

/** `POST/PUT /admin/products/{productId}/prices` — snake_case theo tài liệu pricing */
export type ProductPriceUpsertRequest = {
  /** Nên gửi khi SPU có nhiều SKU — @see docs/FE_PRODUCT_VARIANTS.md §4.1 */
  product_variant_id?: number;
  unit_id?: number;
  current_value: number;
  old_value?: number | null;
  /** Tên hiển thị tuỳ chỉnh (ví dụ: "Hộp 6 chiếc"). Không bắt buộc. */
  display_name?: string | null;
};

/** `docs/API_product_policies_FE.md` — phần tử trong `policies` */
export interface PolicyResponse {
  id: number;
  code: string | null;
  name: string;
  policyType: string;
  numericValue: number | null;
  textValue: string | null;
  detail: string | null;
  active: boolean | null;
}

/** Phần tử `prices[]` / `newPrices[]` — snake_case theo BE. @see docs/PRODUCT_AND_PRICE_API_FE.md §1 */
export type CreatePriceRequest = {
  unit_id: number;
  current_value: number;
  /** Không gửi → BE coi như `0` */
  old_value?: number;
  /**
   * BE một số bản map `price` vẫn NOT NULL — khi chỉ có `product_variant_id` trên INSERT bị lỗi DB.
   * FE gửi kèm khi PUT sản phẩm có sẵn `product id` (multipart/JSON đều cùng part `product`).
   */
  product_id?: number;
  /** Tên hiển thị tuỳ chỉnh — gửi khi tạo giá mới kèm SKU. @see ProductPrice.displayName */
  display_name?: string | null;
};

/** Phần tử `updatedPrices[]` khi `PUT /admin/products/{id}`. @see docs/PRODUCT_AND_PRICE_API_FE.md §2a */
export type UpdateProductPriceItemRequest = {
  id: number;
  current_value: number;
  /** Đổi đơn vị; không gửi → giữ unit cũ */
  unit_id?: number;
  /** Không gửi → giữ `old_value` trên DB */
  old_value?: number;
  /** Tên hiển thị tuỳ chỉnh — `null` xóa tên; không gửi → giữ nguyên. @see ProductPrice.displayName */
  display_name?: string | null;
};

/** Phần tử `variants[]` / `newVariants[]` — @see docs/FE_PRODUCT_VARIANTS.md §2; PUT `newVariants`: @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.4 */
export type CreateProductVariantRequest = {
  skuCode: string;
  optionValues: Record<string, string>;
  active: boolean;
  sortOrder: number;
  /** Optional khi PUT `newVariants` — @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.4 */
  prices?: CreatePriceRequest[];
};

/** `updatedVariants[]` khi `PUT /admin/products/{id}` — @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.4 */
export type UpdateProductVariantItemRequest = {
  id: number;
  skuCode?: string;
  optionValues?: Record<string, string>;
  active?: boolean;
  sortOrder?: number;
  newPrices?: CreatePriceRequest[];
  updatedPrices?: UpdateProductPriceItemRequest[];
  removedPriceIds?: number[];
  /** Document ảnh thuộc SKU (`entity_type` variant) — @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4.2 */
  removedDocumentIds?: number[];
  mainDocumentId?: number | null;
};

/** Bậc giá theo SL (mix-and-match / volume) — snapshot trên `ProductFullResponse`. */
export interface VolumePriceTier {
  id: number;
  productId?: number;
  minQuantity: number;
  unitPrice: number;
  enabled: boolean;
}

/** Purchase-with-purchase — snapshot trên `ProductFullResponse`. */
export interface PurchaseWithPurchaseProgram {
  role: 'companion' | 'anchor';
  id: number;
  /** Thu hẹp neo theo phân loại — khi BE trả kèm snapshot. @json snake: `anchor_variant_id` */
  anchorVariantId?: number;
  /** Thu hẹp SP đi kèm theo phân loại. @json snake: `companion_variant_id` */
  companionVariantId?: number;
  anchorProductId?: number;
  companionProductId?: number;
  promoUnitPrice?: number;
  minAnchorQuantity?: number;
  companionPromoUnitsPerAnchor?: number;
  maxCompanionPromoUnits?: number | null;
  enabled?: boolean;
}

/** `GET` — từng SKU trong `ProductFullResponse.variants` */
export interface ProductVariantResponse {
  id: number;
  skuCode: string;
  optionValues: Record<string, string>;
  active: boolean;
  sortOrder: number;
  prices: ProductPrice[] | null;
  /** Đơn giá áp dụng cho khách tại thời điểm gọi API (đã tính Price Change). @json snake: `effective_unit_price` */
  effectiveUnitPrice?: number | null;
  /** PC đang gắn snapshot cho SKU (null = không có). @json snake: `active_price_change` */
  activePriceChange?: ProductPriceChange | null;
  /** Hydrate ảnh SKU nếu BE trả kèm — @see docs/GUIDE_ADMIN_THEM_SAN_PHAM_VA_MEDIA.md §4 */
  documents?: ProductDocumentSummary[] | null;
}

/** `POST /admin/products` — `l_description`: mô tả dài PDP, xem docs/FE_UPDATE_PRODUCT_L_DESCRIPTION_AND_DOCUMENTS.md */
export interface CreateProductRequest {
  productName: string;
  categoryId: number;
  /** `brand_id` — @see docs/ADMIN_BRANDS.md */
  brandId?: number | null;
  description?: string;
  l_description?: string;
  /** Chuỗi tag cách nhau dấu phẩy — ví dụ `"sale, audio"`. */
  tag?: string;
  status?: number;
  /** Stock Keeping Unit (number). Can be null for old data. */
  sku?: number | null;
  prices?: CreatePriceRequest[];
  /**
   * Luồng khuyến nghị: gửi `variants` (đa SKU). Nếu có `variants` hợp lệ thì không cần `prices` gốc.
   * @see docs/FE_PRODUCT_VARIANTS.md §2
   */
  variants?: CreateProductVariantRequest[];
  isFeatured?: boolean;
  hotSale?: boolean;
}

/**
 * `PUT /admin/products/{id}` — partial update (JSON hoặc part `product` trong multipart).
 * @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md
 */
export interface UpdateProductRequest {
  productName?: string;
  /** Gửi `null` để gỡ hãng khỏi sản phẩm (nếu BE hỗ trợ). @see docs/ADMIN_BRANDS.md */
  brandId?: number | null;
  description?: string;
  /** JSON: `l_description` — mô tả dài PDP. @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.1 */
  l_description?: string;
  /** Chuỗi tag cách nhau dấu phẩy — gửi `""` để xóa hết (nếu BE hỗ trợ). */
  tag?: string;
  status?: number;
  categoryId?: number;
  sku?: number | null;
  isFeatured?: boolean;
  hotSale?: boolean;
  /** @see docs/DOCUMENT_MEDIA_API_FE.md §8a — chỉ các document thuộc đúng sản phẩm này */
  removedDocumentIds?: number[];
  /** @see docs/DOCUMENT_MEDIA_API_FE.md §8a — @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.2 */
  mainDocumentId?: number | null;
  /**
   * Chỉ với multipart + part `newImages`: chỉ số **0-based** file mới được đặt làm ảnh chính.
   * Không mix tùy tiện với `mainDocumentId` — @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.2
   */
  mainNewImageIndex?: number;
  /**
   * Giá legacy ở gốc — áp vào **một phân loại đại diện** (`sortOrder` nhỏ nhất; nếu trùng thì `id` nhỏ hơn).
   * SP đa SKU: ưu tiên chỉnh qua `updatedVariants`. @see docs/GUIDE_ADMIN_UPDATE_PRODUCT.md §3.3
   */
  removedPriceIds?: number[];
  updatedPrices?: UpdateProductPriceItemRequest[];
  newPrices?: CreatePriceRequest[];

  newVariants?: CreateProductVariantRequest[];
  updatedVariants?: UpdateProductVariantItemRequest[];
  removedVariantIds?: number[];
}

/** `document.type`: `1` ảnh, `2` video, `3` tài liệu; `0` legacy (coi như ảnh trong gallery). */
export type DocumentKind = 0 | 1 | 2 | 3;

/** Theo BE `ProductDocumentSummary` — trong `ProductFullResponse.documents`. */
export interface ProductDocumentSummary {
  id?: number | null;
  fileName?: string | null;
  filePath?: string | null;
  fileSize?: string | null;
  type?: DocumentKind | number | null;
  /** Ảnh đại diện — chỉ tin khi `type === 1` hoặc legacy `0`. JSON có thể là `isMain`. */
  isMain?: boolean | null;
}

export interface ProductFullResponse {
  id: number;
  /** Stock Keeping Unit (number). Can be null for old data. */
  sku?: number | null;
  productName: string;
  description: string;
  /** Mô tả dài PDP (HTML) — có thể thiếu trên một số bản BE / list */
  l_description?: string | null;
  status: number;
  isFeatured: boolean;
  /** Một số API list có thể chưa gửi — coi là false nếu thiếu */
  hotSale?: boolean;
  soldCount: number;
  /** Chuỗi một cột — ví dụ `"speaker,beats,bluetooth"` hoặc `"sale, audio"`. */
  tag?: string | null;
  createdDate: string;
  modifiedDate: string;
  brand: BrandSummary | null;
  category: CategorySummary | null;
  prices: ProductPrice[] | null;
  recommendationScore: number | null;
  recommendationSource: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  /** Một số bản API có thể trả — không có trong tài liệu tối thiểu */
  thumbnailUrl?: string | null;
  mainImageUrl?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  /** Tất cả URL ảnh (đã lọc document video). BE populate từ bảng `document`. @see docs/FE_PRODUCT_IMAGES_RESPONSE.md */
  imageUrls?: string[] | null;
  /** Chi tiết từng file media (ảnh + video); thứ tự id document. @see docs/FE_PRODUCT_IMAGES_RESPONSE.md */
  documents?: ProductDocumentSummary[] | null;
  /** Chỉ có trên PDP / detail API — list/search có thể không gửi field (docs/API_product_policies_FE.md) */
  policies?: PolicyResponse[] | null;
  /** Danh sách SKU — @see docs/FE_PRODUCT_VARIANTS.md */
  variants?: ProductVariantResponse[] | null;
  /**
   * Min `effective_unit_price` trên phân loại active — storefront «Từ … ₫».
   * @json snake: `from_effective_unit_price`
   */
  fromEffectiveUnitPrice?: number | null;
  /** Bậc mua nhiều (snapshot; chỉ khi có cấu hình). @json snake: `volume_price_tiers` */
  volumePriceTiers?: VolumePriceTier[] | null;
  /** Chương trình mua kèm (snapshot). @json snake: `purchase_with_purchase_programs` */
  purchaseWithPurchasePrograms?: PurchaseWithPurchaseProgram[] | null;
}

/** Phản hồi GET và body POST/PUT `.../price-changes` — đồng bộ `UpsertPriceChangeRequest` / `ProductPriceChangeResponse`. */
export type ProductPriceChange = {
  id: number;
  productId: number;
  /** Theo SKU — GET `…/variants/{variantId}/price-changes` */
  productVariantId?: number | null;
  basePrice: number;
  salePrice: number | null;
  startAt: string;
  endAt: string | null;
  enabled: boolean;
  quantityLimit?: number | null;
  soldQuantity?: number | null;
  remainingQuantity?: number | null;
  maxPerCustomer?: number | null;
  requiredPaymentMethodCode?: string | null;
};

/**
 * Body POST / PUT đợt giá theo thời gian — JSON camelCase, `startAt`/`endAt` nên là ISO 8601.
 * PUT: đủ field bắt buộc (`basePrice`, `startAt`); `salePrice`/`endAt` null = không KM / không hạn đến;
 * `enabled` không gửi hoặc null trên BE có thể giữ nguyên — form admin luôn gửi boolean khi lưu đầy đủ.
 */
export type ProductPriceChangeUpsert = {
  basePrice: number;
  salePrice: number | null;
  startAt: string;
  endAt: string | null;
  enabled: boolean;
  quantityLimit?: number | null;
  maxPerCustomer?: number | null;
  requiredPaymentMethodCode?: string | null;
};

/** `GET /products/{id}/detail` — docs/product_api.md */
export interface ProductDetailResponse {
  product: ProductFullResponse;
  recommendations: ProductFullResponse[];
}

/** Phần tử `data[]` sau `POST /admin/document/upload` — tên field có thể khác tùy serialize BE */
export interface AdminDocumentRecord {
  id?: number;
  fileName?: string;
  file_name?: string;
  filePath?: string;
  file_path?: string;
  fileSize?: string;
  file_size?: string;
  type?: number;
  isMain?: boolean;
  is_main?: boolean;
  entityId?: number;
  entity_id?: number;
  entityType?: number;
  entity_type?: number;
  description?: string | null;
  [key: string]: unknown;
}

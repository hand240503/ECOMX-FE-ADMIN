/**
 * Quy chuẩn `document.entity_type` (ShopTechnology / DocumentEntityType).
 * FE gửi đúng số trong multipart upload (cùng `entityId`).
 *
 * @see BE DOC_LOGIC — Upload document & entity_type / entity_id
 */
export const DOCUMENT_ENTITY_TYPE_UNASSIGNED = -1;

/** `ID_DOCUMENT_ENTITY_PRODUCT` — `entity_id` = `products.id` */
export const DOCUMENT_ENTITY_TYPE_PRODUCT = 100_000;

/** `ID_DOCUMENT_ENTITY_USER` — `entity_id` = `users.id` */
export const DOCUMENT_ENTITY_TYPE_USER = 200_000;

/** `ID_DOCUMENT_ENTITY_CATEGORY` — `entity_id` = `category.id` */
export const DOCUMENT_ENTITY_TYPE_CATEGORY = 300_000;

/** `ID_DOCUMENT_ENTITY_BRAND` — `entity_id` = `brands.id` */
export const DOCUMENT_ENTITY_TYPE_BRAND = 400_000;

/** `ID_DOCUMENT_ENTITY_ORDER` — `entity_id` = `orders.id` */
export const DOCUMENT_ENTITY_TYPE_ORDER = 500_000;

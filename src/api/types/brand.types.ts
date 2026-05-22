/**
 * Thương hiệu / hãng — gắn với `brand_id` sản phẩm.
 * @see docs/ADMIN_BRANDS.md
 */
export type BrandResponse = {
  id: number;
  /** Mã hãng, duy nhất trong DB */
  code: string;
  name: string;
  /** 1 = active */
  status: number;
  /** URL logo hãng trên Cloudinary (is_main=true). null nếu chưa upload. */
  logoUrl?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

/** `POST /admin/brands` */
export type CreateBrandRequest = {
  code: string;
  name: string;
  status?: number;
};

/** `PUT /admin/brands/{id}` — partial update */
export type UpdateBrandRequest = Partial<CreateBrandRequest>;

/**
 * Danh mục sản phẩm (cây cha–con).
 * @see docs/ADMIN_CATEGORIES.md
 */
export type CategoryResponse = {
  id: number;
  /** Mã danh mục, duy nhất trong DB (so khớp đúng chuỗi đã lưu) */
  code: string;
  name: string;
  /** 1 = active */
  status: number;
  parentId: number | null;
  parentName?: string | null;
  children?: CategoryResponse[] | null;
  childrenCount?: number | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
  /** URL ảnh đại diện danh mục (Cloudinary). null nếu chưa upload. */
  thumbnailUrl?: string | null;
};

/** `POST /admin/categories` */
export type CreateCategoryRequest = {
  code: string;
  name: string;
  status: number;
  parentId?: number | null;
};

/** `PUT /admin/categories/{id}` — partial update */
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

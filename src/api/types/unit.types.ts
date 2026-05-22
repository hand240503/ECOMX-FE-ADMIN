/**
 * Đơn vị tính (Unit) — gắn với `price.unit_id` của sản phẩm.
 * @see docs/ADMIN_UNITS.md
 */
export type UnitResponse = {
  id: number;
  /** Tên hiển thị, snake_case theo BE */
  name_unit: string;
  /** Hệ số quy đổi, >= 1 */
  ratio: number;
  /** 1 = active */
  status: number;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

/** `POST /admin/units` */
export type CreateUnitRequest = {
  name_unit: string;
  ratio?: number;
  status?: number;
};

/** `PUT /admin/units/{id}` — partial update */
export type UpdateUnitRequest = Partial<CreateUnitRequest>;

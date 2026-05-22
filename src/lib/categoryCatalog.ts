import type { CategoryResponse } from '../api/types/category.types';

export function flattenCategories(nodes: CategoryResponse[]): CategoryResponse[] {
  const out: CategoryResponse[] = [];

  const walk = (list: CategoryResponse[] | null | undefined) => {
    if (!list?.length) return;
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };

  walk(nodes);
  return out;
}

function slugLoose(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Tham số URL chỉ là số → dùng trực tiếp làm categoryId cho API sản phẩm. */
export function parseNumericCategoryIdFromParam(param: string): number | undefined {
  const raw = param.trim();
  if (!/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return id > 0 ? id : undefined;
}

export function resolveCategoryByParam(
  flat: CategoryResponse[],
  param: string
): CategoryResponse | undefined {
  const raw = param.trim();
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    return flat.find((c) => c.id === id);
  }

  const lower = raw.toLowerCase();

  return flat.find(
    (c) =>
      c.code.toLowerCase() === lower ||
      slugLoose(c.name) === lower ||
      c.name.trim().toLowerCase() === lower
  );
}

export function findCategoryById(
  flat: CategoryResponse[],
  id: number | null | undefined
): CategoryResponse | undefined {
  if (id == null) return undefined;
  return flat.find((c) => c.id === id);
}

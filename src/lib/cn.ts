import { clsx, type ClassValue } from 'clsx';

/** Gộp className có điều kiện (dùng chung cho UI primitives). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

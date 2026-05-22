import axios from 'axios';
import type { ApiResponse } from '../api/types/common.types';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse | undefined;
    const first = data?.errors?.[0]?.message;
    if (typeof first === 'string' && first.trim() !== '') return first.trim();
    if (typeof data?.message === 'string' && data.message.trim() !== '') return data.message.trim();
  }
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

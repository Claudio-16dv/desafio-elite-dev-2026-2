import { apiRequest } from '@/lib/api-client';
import type { Receipt } from '@/types/api';

export const receiptsApi = {
  /** Pública (acesso por link): não envia token. */
  get: (code: string) => apiRequest<Receipt>(`/receipts/${encodeURIComponent(code)}`, { auth: false }),
};

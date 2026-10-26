import { apiRequest } from '@/lib/api-client';
import type { LotDetail, LotSummary, Paginated } from '@/types/api';

export type ShowcaseStatus = 'live' | 'scheduled' | 'closed';
export type LotSort = 'ending_soon' | 'newest' | 'most_bids';

export interface LotsQuery {
  status: ShowcaseStatus;
  q?: string;
  sort?: LotSort;
  page: number;
  pageSize?: number;
}

export const lotsApi = {
  /** Vitrine pública (lotes cancelados nunca aparecem). */
  list(query: LotsQuery) {
    const params = new URLSearchParams({ status: query.status, page: String(query.page) });
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    return apiRequest<Paginated<LotSummary>>(`/lots?${params.toString()}`, { auth: false });
  },

  /** Sala do lote. Com login, devolve também a situação do usuário (`me`). */
  detail(id: string) {
    return apiRequest<LotDetail>(`/lots/${id}`);
  },
};

import { apiRequest } from '@/lib/api-client';
import type { CatalogSearchResult, CreateLotInput, LotSummary, SellerSummary } from '@/types/api';

export interface CatalogQuery {
  q?: string;
  type?: string;
  page: number;
}

export const sellerApi = {
  lots: () => apiRequest<{ items: LotSummary[]; serverNow: string }>('/seller/lots'),
  summary: () => apiRequest<SellerSummary>('/seller/summary'),
  createLot: (input: CreateLotInput) => apiRequest<LotSummary>('/lots', { method: 'POST', body: input }),
  cancelLot: (id: string) => apiRequest<LotSummary>(`/lots/${id}/cancel`, { method: 'POST' }),
  searchCatalog(query: CatalogQuery) {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.q) params.set('q', query.q);
    if (query.type) params.set('type', query.type);
    return apiRequest<CatalogSearchResult>(`/catalog/items?${params.toString()}`);
  },
};

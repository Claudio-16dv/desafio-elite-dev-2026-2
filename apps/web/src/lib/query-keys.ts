/** Chaves do TanStack Query centralizadas: evita strings soltas e facilita invalidar o cache. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  wallet: ['wallet'] as const,
  lots: (params: Record<string, unknown>) => ['lots', params] as const,
  lotsAll: ['lots'] as const,
  lot: (id: string) => ['lot', id] as const,
  sellerLots: ['seller', 'lots'] as const,
  sellerSummary: ['seller', 'summary'] as const,
  catalog: (params: Record<string, unknown>) => ['catalog', params] as const,
  participations: ['bidder', 'participations'] as const,
  audit: (lotId: string) => ['audit', lotId] as const,
  receipt: (code: string) => ['receipt', code] as const,
};

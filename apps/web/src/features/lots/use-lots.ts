'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { lotsApi, type LotsQuery } from './lots-api';

/** Vitrine paginada. Atualiza sozinha a cada 10 s (preço atual e status mudam o tempo todo). */
export function useLots(query: LotsQuery) {
  return useQuery({
    queryKey: queryKeys.lots({ ...query }),
    queryFn: () => lotsApi.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: query.status === 'closed' ? 30_000 : 10_000,
  });
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/query-keys';
import { walletApi } from './wallet-api';

/** Carteira do usuário logado (saldo total, comprometido, disponível e movimentações). */
export function useWallet() {
  const { status } = useAuth();
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: walletApi.get,
    enabled: status === 'authenticated',
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amountCents: number) => walletApi.deposit(amountCents),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallet }),
  });
}

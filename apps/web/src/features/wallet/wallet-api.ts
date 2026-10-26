import { apiRequest } from '@/lib/api-client';
import type { Wallet, WalletSummary } from '@/types/api';

export const walletApi = {
  get: () => apiRequest<Wallet>('/wallet'),
  deposit: (amountCents: number) =>
    apiRequest<WalletSummary>('/wallet/deposit', { method: 'POST', body: { amountCents } }),
};

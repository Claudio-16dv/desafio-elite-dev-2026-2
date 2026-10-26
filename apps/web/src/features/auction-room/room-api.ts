import { apiRequest } from '@/lib/api-client';
import type { PlaceBidResult } from '@/types/api';

export const roomApi = {
  placeBid: (lotId: string, amountCents: number) =>
    apiRequest<PlaceBidResult>(`/lots/${lotId}/bids`, { method: 'POST', body: { amountCents } }),
};

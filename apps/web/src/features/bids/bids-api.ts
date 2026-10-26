import { apiRequest } from '@/lib/api-client';
import type { Participation } from '@/types/api';

export const bidsApi = {
  participations: () => apiRequest<{ items: Participation[]; serverNow: string }>('/bidder/participations'),
};

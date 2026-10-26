import { apiRequest } from '@/lib/api-client';
import type { LotAudit } from '@/types/api';

export const auditApi = {
  /** Pública: não envia token. */
  lot: (lotId: string) => apiRequest<LotAudit>(`/audit/lots/${lotId}`, { auth: false }),
};

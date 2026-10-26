export type LotStatus = 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'CANCELED';

export interface LotTiming {
  startsAt: Date;
  endsAt: Date;
  canceledAt: Date | null;
}

/**
 * O status é DERIVADO do tempo, não gravado: assim nunca fica defasado
 * (um lote "ao vivo" no banco que já passou do horário seria um bug clássico).
 *  - CANCELED: cancelado pelo leiloeiro;
 *  - SCHEDULED: ainda não começou;
 *  - LIVE: entre início e fim;
 *  - CLOSED: passou do fim (a liquidação roda logo em seguida e marca `settledAt`).
 */
export function deriveLotStatus(lot: LotTiming, now: Date): LotStatus {
  if (lot.canceledAt) return 'CANCELED';
  if (now < lot.startsAt) return 'SCHEDULED';
  if (now < lot.endsAt) return 'LIVE';
  return 'CLOSED';
}

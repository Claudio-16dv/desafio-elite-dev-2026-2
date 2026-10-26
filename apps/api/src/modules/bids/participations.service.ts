import { Injectable } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../prisma/prisma.service';
import { LotViewMapper } from '../lots/lot-view.mapper';
import { LotSummaryView } from '../lots/lot-view.types';

export type ParticipationStatus =
  | 'LEADING' // lote em andamento (ou aguardando liquidação) e o usuário lidera
  | 'OUTBID' // lote em andamento e o usuário foi superado
  | 'WON' // lote liquidado e o usuário venceu
  | 'LOST' // lote liquidado e outra pessoa venceu
  | 'CANCELED'; // lote cancelado (o valor comprometido foi liberado)

export interface ParticipationView {
  lot: LotSummaryView;
  status: ParticipationStatus;
  myHighestBidCents: number;
  /** Código do comprovante (link de compartilhamento), apenas quando venceu. */
  receiptCode: string | null;
}

/** "Meus arremates": lotes em que o licitante deu lance e os que ele venceu. */
@Injectable()
export class ParticipationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly mapper: LotViewMapper,
  ) {}

  async list(bidderId: string): Promise<{ items: ParticipationView[]; serverNow: string }> {
    const now = this.clock.now();

    const [lots, best] = await Promise.all([
      this.prisma.lot.findMany({
        where: { bids: { some: { bidderId } } },
        include: { receipt: { select: { code: true } } },
        orderBy: { endsAt: 'desc' },
        take: 200,
      }),
      this.prisma.bid.groupBy({
        by: ['lotId'],
        where: { bidderId },
        _max: { amountCents: true },
      }),
    ]);
    const bestByLot = new Map(best.map((row) => [row.lotId, row._max.amountCents ?? 0]));

    const items = lots.map<ParticipationView>(({ receipt, ...lot }) => {
      let status: ParticipationStatus;
      if (lot.canceledAt) status = 'CANCELED';
      else if (lot.settledAt) status = lot.winnerId === bidderId ? 'WON' : 'LOST';
      else status = lot.leaderId === bidderId ? 'LEADING' : 'OUTBID';

      return {
        lot: this.mapper.toSummary(lot, now),
        status,
        myHighestBidCents: bestByLot.get(lot.id) ?? 0,
        receiptCode: status === 'WON' ? (receipt?.code ?? null) : null,
      };
    });

    return { items, serverNow: now.toISOString() };
  }
}

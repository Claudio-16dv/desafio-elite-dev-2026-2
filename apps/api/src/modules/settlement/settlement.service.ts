import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrityService } from '../integrity/integrity.service';
import { LotViewMapper } from '../lots/lot-view.mapper';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletLedger, WalletSummary } from '../wallet/wallet-ledger';

export type SettlementOutcome =
  | { kind: 'SKIPPED' } // nada a fazer (já liquidado, cancelado ou ainda no prazo)
  | { kind: 'TAMPERED'; issues: string[] } // histórico adulterado: NÃO liquida
  | { kind: 'UNSOLD' }
  | { kind: 'SOLD'; finalPriceCents: number; receiptCode: string };

/**
 * Liquidação de lotes encerrados:
 *  - com lances: debita o vencedor (saldo e comprometido), credita o leiloeiro, emite o comprovante;
 *  - sem lances: fecha sem vencedor.
 * Tudo em uma transação com o lote travado, então rodar duas vezes (ou em duas instâncias)
 * nunca liquida em duplicidade.
 *
 * Antes de mexer em dinheiro, a cadeia de hashes é reverificada: um lote adulterado
 * NÃO é liquidado automaticamente (fica para revisão humana).
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly integrity: IntegrityService,
    private readonly ledger: WalletLedger,
    private readonly realtime: RealtimeService,
    private readonly mapper: LotViewMapper,
  ) {}

  /** Ids de lotes vencidos e ainda não liquidados. */
  async findDueLotIds(limit = 50, excludeIds: Iterable<string> = []): Promise<string[]> {
    const exclude = [...excludeIds];
    const rows = await this.prisma.lot.findMany({
      where: {
        settledAt: null,
        canceledAt: null,
        endsAt: { lte: this.clock.now() },
        ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
      },
      select: { id: true },
      orderBy: { endsAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  async settleLot(lotId: string): Promise<SettlementOutcome> {
    const now = this.clock.now();

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId}::uuid FOR UPDATE`;
        const lot = await tx.lot.findUnique({
          where: { id: lotId },
          include: { bids: { orderBy: { sequence: 'asc' } } },
        });
        if (!lot || lot.settledAt || lot.canceledAt || now < lot.endsAt) {
          return { outcome: { kind: 'SKIPPED' } as SettlementOutcome };
        }

        const verification = this.integrity.verifyChain(lot, lot.bids);
        if (!verification.valid) {
          return {
            outcome: {
              kind: 'TAMPERED',
              issues: verification.issues.map((issue) => issue.message),
            } as SettlementOutcome,
          };
        }

        // Sem lances: fecha sem vencedor.
        if (lot.bidCount === 0 || !lot.leaderId || lot.currentBidCents === null) {
          const closed = await tx.lot.update({ where: { id: lotId }, data: { settledAt: now } });
          return { outcome: { kind: 'UNSOLD' } as SettlementOutcome, lot: closed };
        }

        const winnerId = lot.leaderId;
        const price = lot.currentBidCents;
        await this.ledger.lock(tx, [winnerId, lot.sellerId]);
        const buyerWallet = await this.ledger.settlePurchase(tx, winnerId, price, lotId);
        const sellerWallet = await this.ledger.settleSale(tx, lot.sellerId, price, lotId);

        const code = randomBytes(9).toString('base64url');
        const chainHeadHash = lot.chainHeadHash as string;
        await tx.receipt.create({
          data: {
            code,
            lotId,
            winnerId,
            sellerId: lot.sellerId,
            finalPriceCents: price,
            bidCount: lot.bidCount,
            chainHeadHash,
            issuedAt: now,
            seal: this.integrity.receiptSeal({
              code,
              lotId,
              winnerId,
              sellerId: lot.sellerId,
              finalPriceCents: price,
              bidCount: lot.bidCount,
              chainHeadHash,
              issuedAt: now,
            }),
          },
        });
        const closed = await tx.lot.update({
          where: { id: lotId },
          data: { settledAt: now, winnerId, finalPriceCents: price },
        });

        return {
          outcome: { kind: 'SOLD', finalPriceCents: price, receiptCode: code } as SettlementOutcome,
          lot: closed,
          wallets: [
            [winnerId, buyerWallet],
            [lot.sellerId, sellerWallet],
          ] as Array<[string, WalletSummary]>,
        };
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    const { outcome } = result;
    if ('lot' in result && result.lot) {
      const view = this.mapper.toResult(result.lot);
      this.realtime.lotClosed({
        lotId,
        sold: view?.sold ?? false,
        finalPriceCents: view?.finalPriceCents ?? null,
        winnerPseudonym: view?.winnerPseudonym ?? null,
        serverNow: now.toISOString(),
      });
      this.logger.log(
        outcome.kind === 'SOLD'
          ? `Lote ${lotId} arrematado por ${outcome.finalPriceCents} centavos`
          : `Lote ${lotId} encerrado sem lances`,
      );
    }
    if ('wallets' in result && result.wallets) {
      for (const [userId, wallet] of result.wallets) this.realtime.walletUpdated(userId, wallet);
    }
    return outcome;
  }
}

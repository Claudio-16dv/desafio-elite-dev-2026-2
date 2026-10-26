import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { GENESIS_HASH } from '../integrity/hash-chain';
import { IntegrityService } from '../integrity/integrity.service';
import { LotViewMapper } from '../lots/lot-view.mapper';
import { PublicBid } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletLedger, WalletSummary } from '../wallet/wallet-ledger';
import { applyAntiSniping } from './anti-sniping';
import { evaluateBid, minimumNextBidCents } from './bid-rules';

export interface PlaceBidResult {
  bid: PublicBid;
  lot: {
    id: string;
    currentBidCents: number;
    bidCount: number;
    minimumNextBidCents: number;
    endsAt: string;
    extended: boolean;
    leaderPseudonym: string;
  };
  wallet: WalletSummary;
}

/**
 * Caso de uso "dar lance". Toda a operação acontece em UMA transação com travas
 * de linha (SELECT ... FOR UPDATE), nesta ordem fixa: lote -> carteiras (por id).
 *
 * Isso garante, mesmo com lances simultâneos:
 *  - dois lances no mesmo lote são processados em fila (um enxerga o resultado do outro);
 *  - o saldo disponível lido é o mesmo que será alterado (sem gastar o mesmo saldo duas vezes);
 *  - a numeração e o encadeamento de hashes nunca se cruzam.
 */
@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly integrity: IntegrityService,
    private readonly ledger: WalletLedger,
    private readonly realtime: RealtimeService,
    private readonly mapper: LotViewMapper,
  ) {}

  /**
   * @param at instante do lance. Em produção é sempre o relógio do servidor;
   *           o parâmetro existe para o seed/testes simularem o passado.
   */
  async placeBid(
    bidderId: string,
    lotId: string,
    amountCents: number,
    at?: Date,
  ): Promise<PlaceBidResult> {
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Lot" WHERE id = ${lotId}::uuid FOR UPDATE`;
        if (locked.length === 0) {
          throw new DomainException('LOT_NOT_FOUND', 'Lote não encontrado.', HttpStatus.NOT_FOUND);
        }
        // O instante do lance é lido DEPOIS de obter a trava: um lance que esperou na fila
        // é julgado (início/fim, anti-sniping) pela hora em que é de fato processado.
        const now = at ?? this.clock.now();
        const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });

        const previousLeaderId = lot.leaderId;
        const previousAmount = lot.currentBidCents;
        await this.ledger.lock(tx, previousLeaderId ? [bidderId, previousLeaderId] : [bidderId]);

        const wallet = await this.ledger.get(tx, bidderId);
        const evaluation = evaluateBid({
          lot,
          bidderId,
          amountCents,
          availableCents: wallet.availableCents,
          now,
        });
        if (!evaluation.ok) {
          const { code, message, details } = evaluation.rejection;
          throw new DomainException(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
        }

        // Encadeia o lance ao anterior (ou ao GENESIS, se for o primeiro).
        const sequence = lot.bidCount + 1;
        const prevHash = lot.chainHeadHash ?? GENESIS_HASH;
        const hash = this.integrity.bidHash({
          lotId,
          sequence,
          bidderId,
          amountCents,
          placedAt: now,
          prevHash,
        });
        const bid = await tx.bid.create({
          data: { lotId, bidderId, sequence, amountCents, placedAt: now, prevHash, hash },
        });

        // Saldo comprometido: libera o líder anterior (superado) e compromete o novo líder.
        let previousLeaderWallet: WalletSummary | null = null;
        if (previousLeaderId && previousAmount !== null) {
          previousLeaderWallet = await this.ledger.release(tx, previousLeaderId, previousAmount);
        }
        const bidderWallet = await this.ledger.commit(tx, bidderId, amountCents);

        const { endsAt, extended } = applyAntiSniping(lot.endsAt, now);
        const updatedLot = await tx.lot.update({
          where: { id: lotId },
          data: {
            currentBidCents: amountCents,
            leaderId: bidderId,
            bidCount: sequence,
            chainHeadHash: hash,
            chainSeal: this.integrity.lotSeal({
              ...lot,
              endsAt,
              bidCount: sequence,
              chainHeadHash: hash,
              currentBidCents: amountCents,
              leaderId: bidderId,
            }),
            endsAt,
          },
        });

        return {
          now,
          bid,
          lot: updatedLot,
          extended,
          bidderWallet,
          previousLeaderId,
          previousLeaderWallet,
        };
      },
      { maxWait: 5_000, timeout: 10_000 },
    );

    // Só publica em tempo real DEPOIS que a transação foi confirmada.
    const { now, bid, lot, extended, bidderWallet, previousLeaderId, previousLeaderWallet } = outcome;
    const publicBid = this.mapper.toPublicBid(bid);
    const leaderPseudonym = publicBid.bidderPseudonym;
    const minimumNext = minimumNextBidCents(lot);

    this.realtime.lotBid({
      lotId,
      bid: publicBid,
      currentBidCents: amountCents,
      bidCount: lot.bidCount,
      minimumNextBidCents: minimumNext,
      leaderPseudonym,
      endsAt: lot.endsAt.toISOString(),
      extended,
      serverNow: now.toISOString(),
    });
    this.realtime.walletUpdated(bidderId, bidderWallet);
    if (previousLeaderId && previousLeaderWallet) {
      this.realtime.walletUpdated(previousLeaderId, previousLeaderWallet);
      this.realtime.outbid(previousLeaderId, {
        lotId,
        lotTitle: lot.title,
        newAmountCents: amountCents,
      });
    }

    return {
      bid: publicBid,
      lot: {
        id: lotId,
        currentBidCents: amountCents,
        bidCount: lot.bidCount,
        minimumNextBidCents: minimumNext,
        endsAt: lot.endsAt.toISOString(),
        extended,
        leaderPseudonym,
      },
      wallet: bidderWallet,
    };
  }
}

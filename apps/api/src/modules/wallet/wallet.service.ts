import { HttpStatus, Injectable } from '@nestjs/common';
import { WalletTransactionType } from '@prisma/client';
import { DomainException } from '../../common/errors/domain.exception';
import { formatBRL } from '../../common/money';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletLedger, WalletSummary, toWalletSummary } from './wallet-ledger';

/** Teto do saldo total de uma carteira (R$ 10.000.000,00), com folga para o INT do banco. */
const MAX_BALANCE_CENTS = 1_000_000_000;

export interface WalletTransactionView {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number;
  lotId: string | null;
  createdAt: string;
}

export interface WalletView extends WalletSummary {
  transactions: WalletTransactionView[];
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: WalletLedger,
    private readonly realtime: RealtimeService,
  ) {}

  async getWallet(userId: string): Promise<WalletView> {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
    return {
      ...toWalletSummary(wallet),
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amountCents: t.amountCents,
        balanceAfterCents: t.balanceAfterCents,
        lotId: t.lotId,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /** Depósito simulado (não há pagamento real). */
  async deposit(userId: string, amountCents: number): Promise<WalletSummary> {
    const summary = await this.prisma.$transaction(async (tx) => {
      await this.ledger.lock(tx, [userId]);
      const current = await this.ledger.get(tx, userId);
      if (current.balanceCents + amountCents > MAX_BALANCE_CENTS) {
        throw new DomainException(
          'DEPOSIT_LIMIT_EXCEEDED',
          `O saldo total da carteira não pode passar de ${formatBRL(MAX_BALANCE_CENTS)}.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return this.ledger.deposit(tx, userId, amountCents);
    });
    this.realtime.walletUpdated(userId, summary);
    return summary;
  }
}

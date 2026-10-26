import { Injectable } from '@nestjs/common';
import { Prisma, WalletTransactionType } from '@prisma/client';
import type { Tx } from '../../prisma/prisma.service';

export interface WalletSummary {
  balanceCents: number;
  committedCents: number;
  availableCents: number;
}

export function toWalletSummary(wallet: {
  balanceCents: number;
  committedCents: number;
}): WalletSummary {
  return {
    balanceCents: wallet.balanceCents,
    committedCents: wallet.committedCents,
    availableCents: wallet.balanceCents - wallet.committedCents,
  };
}

/**
 * Único lugar que altera saldos. Todos os métodos recebem o cliente de transação
 * (`tx`) do chamador: assim cada operação de negócio (lance, cancelamento,
 * liquidação) é atômica, e o banco ainda protege com CHECK constraints
 * (saldo >= 0 e 0 <= comprometido <= saldo).
 *
 * Modelo: disponível = saldo total - comprometido.
 *  - comprometido sobe quando o usuário passa a liderar um lote e desce quando é superado;
 *  - saldo total só muda em depósito e na liquidação.
 */
@Injectable()
export class WalletLedger {
  /**
   * Trava (SELECT ... FOR UPDATE) as carteiras em ordem determinística de id.
   * A ordem fixa evita deadlock entre transações que travam as mesmas carteiras.
   */
  async lock(tx: Tx, userIds: string[]): Promise<void> {
    const ids = [...new Set(userIds)].sort();
    if (ids.length === 0) return;
    await tx.$queryRaw`
      SELECT "userId" FROM "Wallet"
      WHERE "userId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY "userId"
      FOR UPDATE`;
  }

  async get(tx: Tx, userId: string): Promise<WalletSummary> {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    return toWalletSummary(wallet);
  }

  async commit(tx: Tx, userId: string, cents: number): Promise<WalletSummary> {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { committedCents: { increment: cents } },
    });
    return toWalletSummary(wallet);
  }

  async release(tx: Tx, userId: string, cents: number): Promise<WalletSummary> {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { committedCents: { decrement: cents } },
    });
    return toWalletSummary(wallet);
  }

  async deposit(tx: Tx, userId: string, cents: number): Promise<WalletSummary> {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balanceCents: { increment: cents } },
    });
    await this.record(tx, userId, 'DEPOSIT', cents, wallet.balanceCents, null);
    return toWalletSummary(wallet);
  }

  /** Liquidação, lado do vencedor: debita o saldo e libera o valor que estava comprometido. */
  async settlePurchase(tx: Tx, buyerId: string, cents: number, lotId: string): Promise<WalletSummary> {
    const wallet = await tx.wallet.update({
      where: { userId: buyerId },
      data: { balanceCents: { decrement: cents }, committedCents: { decrement: cents } },
    });
    await this.record(tx, buyerId, 'PURCHASE_DEBIT', -cents, wallet.balanceCents, lotId);
    return toWalletSummary(wallet);
  }

  /** Liquidação, lado do leiloeiro: credita o valor da venda. */
  async settleSale(tx: Tx, sellerId: string, cents: number, lotId: string): Promise<WalletSummary> {
    const wallet = await tx.wallet.update({
      where: { userId: sellerId },
      data: { balanceCents: { increment: cents } },
    });
    await this.record(tx, sellerId, 'SALE_CREDIT', cents, wallet.balanceCents, lotId);
    return toWalletSummary(wallet);
  }

  private async record(
    tx: Tx,
    userId: string,
    type: WalletTransactionType,
    amountCents: number,
    balanceAfterCents: number,
    lotId: string | null,
  ): Promise<void> {
    await tx.walletTransaction.create({
      data: { userId, type, amountCents, balanceAfterCents, lotId },
    });
  }
}

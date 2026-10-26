/**
 * Regras de aceitação de lance (funções puras, 100% testáveis sem banco).
 * A ordem das verificações define qual mensagem o usuário vê quando
 * mais de uma regra é violada.
 */
import { formatBRL } from '../../common/money';

export interface BiddableLot {
  sellerId: string;
  startsAt: Date;
  endsAt: Date;
  canceledAt: Date | null;
  settledAt: Date | null;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  leaderId: string | null;
}

export type BidRejectionCode =
  | 'LOT_CANCELED'
  | 'LOT_NOT_STARTED'
  | 'LOT_ENDED'
  | 'ALREADY_LEADING'
  | 'BID_BELOW_MINIMUM'
  | 'INSUFFICIENT_BALANCE';

export interface BidRejection {
  code: BidRejectionCode;
  /** Mensagem pronta para o usuário final (pt-BR). */
  message: string;
  details: Record<string, number | string | null>;
}

export type BidEvaluation = { ok: true } | { ok: false; rejection: BidRejection };

export interface EvaluateBidInput {
  lot: BiddableLot;
  bidderId: string;
  amountCents: number;
  /** Saldo disponível = total - comprometido, já lido com a carteira travada. */
  availableCents: number;
  now: Date;
}

/** Menor lance aceitável neste momento. */
export function minimumNextBidCents(
  lot: Pick<BiddableLot, 'currentBidCents' | 'startingBidCents' | 'minIncrementCents'>,
): number {
  return lot.currentBidCents === null
    ? lot.startingBidCents
    : lot.currentBidCents + lot.minIncrementCents;
}

function reject(
  code: BidRejectionCode,
  message: string,
  details: BidRejection['details'] = {},
): BidEvaluation {
  return { ok: false, rejection: { code, message, details } };
}

export function evaluateBid({
  lot,
  bidderId,
  amountCents,
  availableCents,
  now,
}: EvaluateBidInput): BidEvaluation {
  if (lot.canceledAt) {
    return reject('LOT_CANCELED', 'Este lote foi cancelado pelo leiloeiro.');
  }

  if (now < lot.startsAt) {
    return reject(
      'LOT_NOT_STARTED',
      'Este lote ainda não foi iniciado. Os lances abrem no horário de início.',
      { startsAt: lot.startsAt.toISOString() },
    );
  }

  if (lot.settledAt || now >= lot.endsAt) {
    return reject('LOT_ENDED', 'Este lote já foi encerrado e não aceita mais lances.', {
      endedAt: lot.endsAt.toISOString(),
    });
  }

  if (lot.leaderId === bidderId) {
    return reject(
      'ALREADY_LEADING',
      `Você já está ganhando este lote com ${formatBRL(lot.currentBidCents ?? 0)}. Aguarde alguém cobrir seu lance.`,
      { currentBidCents: lot.currentBidCents },
    );
  }

  const minimum = minimumNextBidCents(lot);
  if (amountCents < minimum) {
    const explanation =
      lot.currentBidCents === null
        ? `O lance inicial é ${formatBRL(lot.startingBidCents)}.`
        : `O lance atual é ${formatBRL(lot.currentBidCents)} e o incremento mínimo é ${formatBRL(lot.minIncrementCents)}.`;
    return reject(
      'BID_BELOW_MINIMUM',
      `Lance abaixo do mínimo. ${explanation} O menor lance aceito agora é ${formatBRL(minimum)}.`,
      { minimumBidCents: minimum, amountCents },
    );
  }

  if (amountCents > availableCents) {
    return reject(
      'INSUFFICIENT_BALANCE',
      `Saldo insuficiente. Você tem ${formatBRL(availableCents)} disponível e este lance exige ${formatBRL(amountCents)}. Deposite saldo na sua carteira.`,
      { availableCents, requiredCents: amountCents },
    );
  }

  return { ok: true };
}

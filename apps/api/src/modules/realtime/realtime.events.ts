/**
 * Contrato dos eventos em tempo real (Socket.IO, namespace "/realtime").
 *
 * Salas:
 *  - `lot:<id>`  : qualquer cliente que fez `lot:join` (inclusive anônimo) recebe os eventos do lote.
 *  - `user:<id>` : sala privada do usuário autenticado (token no handshake).
 *
 * Nenhum payload expõe dados pessoais: só pseudônimos por lote.
 */
export const REALTIME_NAMESPACE = '/realtime';

export const ClientEvents = {
  JoinLot: 'lot:join',
  LeaveLot: 'lot:leave',
} as const;

export const ServerEvents = {
  /** Novo lance aceito (inclui nova data de fim se houve prorrogação). */
  LotBid: 'lot:bid',
  /** Lote encerrado e liquidado. */
  LotClosed: 'lot:closed',
  /** Lote cancelado pelo leiloeiro. */
  LotCanceled: 'lot:canceled',
  /** Privado: saldo/comprometido da carteira mudou. */
  WalletUpdated: 'wallet:updated',
  /** Privado: o usuário foi superado em um lote. */
  Outbid: 'bid:outbid',
} as const;

export interface PublicBid {
  sequence: number;
  amountCents: number;
  placedAt: string;
  bidderPseudonym: string;
  hash: string;
  prevHash: string;
}

export interface LotBidEvent {
  lotId: string;
  bid: PublicBid;
  currentBidCents: number;
  bidCount: number;
  minimumNextBidCents: number;
  leaderPseudonym: string;
  endsAt: string;
  /** true quando este lance prorrogou o lote (anti-sniping). */
  extended: boolean;
  serverNow: string;
}

export interface LotClosedEvent {
  lotId: string;
  sold: boolean;
  finalPriceCents: number | null;
  winnerPseudonym: string | null;
  serverNow: string;
}

export interface LotCanceledEvent {
  lotId: string;
  serverNow: string;
}

export interface WalletUpdatedEvent {
  balanceCents: number;
  committedCents: number;
  availableCents: number;
}

export interface OutbidEvent {
  lotId: string;
  lotTitle: string;
  newAmountCents: number;
}

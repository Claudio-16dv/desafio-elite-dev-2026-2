import { Role } from '@prisma/client';
import { PublicBid } from '../realtime/realtime.events';
import { ItemAttribute } from '../catalog/catalog.types';
import { LotStatus } from './lot-status';

export interface LotResult {
  sold: boolean;
  finalPriceCents: number | null;
  winnerPseudonym: string | null;
}

/** Visão pública de um lote (sem dados pessoais: só pseudônimos). */
export interface LotSummaryView {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  attributes: ItemAttribute[];
  source: string;
  sourceUrl: string | null;
  status: LotStatus;
  /** true quando o lote encerrado já foi liquidado (resultado definitivo). */
  settled: boolean;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  /** true quando o anti-sniping prorrogou o fim do lote. */
  extended: boolean;
  currentBidCents: number | null;
  minimumNextBidCents: number;
  bidCount: number;
  leaderPseudonym: string | null;
  sellerPseudonym: string;
  result: LotResult | null;
}

/** O que o usuário logado precisa saber sobre a própria situação no lote. */
export interface LotViewerState {
  role: Role;
  isOwner: boolean;
  /** Pseudônimo do usuário NESTE lote (para reconhecer os próprios lances no histórico). */
  pseudonym: string;
  isLeading: boolean;
  highestBidCents: number | null;
  /** 1 = líder; null = ainda não deu lance. */
  position: number | null;
  /** Presente apenas para o vencedor de um lote liquidado. */
  receiptCode: string | null;
}

export interface LotDetailView extends LotSummaryView {
  bids: PublicBid[];
  me: LotViewerState | null;
  serverNow: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  serverNow: string;
}

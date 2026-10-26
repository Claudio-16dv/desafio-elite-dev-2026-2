import type { LotBidEvent, LotCanceledEvent, LotClosedEvent, LotDetail, LotViewerState, PublicBid } from '@/types/api';

/** Detalhe do lote + diferença entre o relógio do servidor e o do navegador. */
export type LotRoomData = LotDetail & { serverOffsetMs: number };

/** Evento de lance; `serverNow` é opcional (a resposta HTTP do próprio lance não traz o relógio). */
export type BidAppliedEvent = Omit<LotBidEvent, 'serverNow'> & { serverNow?: string };

/**
 * Recalcula a situação do usuário (líder? melhor lance? posição?) a partir do histórico.
 * Funciona só com pseudônimos, o mesmo identificador que a API expõe publicamente.
 */
export function deriveViewerState(
  me: LotViewerState,
  bids: PublicBid[],
  leaderPseudonym: string | null,
): LotViewerState {
  const bestByBidder = new Map<string, number>();
  for (const bid of bids) {
    bestByBidder.set(bid.bidderPseudonym, Math.max(bestByBidder.get(bid.bidderPseudonym) ?? 0, bid.amountCents));
  }
  const ranking = [...bestByBidder.entries()].sort((a, b) => b[1] - a[1]);
  const index = ranking.findIndex(([pseudonym]) => pseudonym === me.pseudonym);

  return {
    ...me,
    isLeading: !me.isOwner && leaderPseudonym !== null && leaderPseudonym === me.pseudonym,
    highestBidCents: bestByBidder.get(me.pseudonym) ?? null,
    position: index === -1 ? null : index + 1,
  };
}

/** Número de licitantes distintos no histórico. */
export function countBidders(bids: PublicBid[]): number {
  return new Set(bids.map((bid) => bid.bidderPseudonym)).size;
}

/**
 * Aplica um lance (vindo do WebSocket ou da resposta HTTP) ao detalhe em cache.
 * É idempotente (lance repetido é ignorado) e tolera chegada fora de ordem.
 */
export function applyBidEvent(prev: LotRoomData, event: BidAppliedEvent): LotRoomData {
  if (event.lotId !== prev.id) return prev;
  if (prev.bids.some((bid) => bid.sequence === event.bid.sequence)) return prev;

  const bids = [...prev.bids, event.bid].sort((a, b) => a.sequence - b.sequence);
  const isNewest = event.bid.sequence >= prev.bidCount;
  if (!isNewest) return { ...prev, bids };

  const leaderPseudonym = event.leaderPseudonym;
  return {
    ...prev,
    bids,
    currentBidCents: event.currentBidCents,
    bidCount: event.bidCount,
    minimumNextBidCents: event.minimumNextBidCents,
    leaderPseudonym,
    endsAt: event.endsAt,
    extended: prev.extended || event.extended,
    serverOffsetMs: event.serverNow ? Date.parse(event.serverNow) - Date.now() : prev.serverOffsetMs,
    me: prev.me ? deriveViewerState(prev.me, bids, leaderPseudonym) : null,
  };
}

export function applyClosedEvent(prev: LotRoomData, event: LotClosedEvent): LotRoomData {
  if (event.lotId !== prev.id) return prev;
  return {
    ...prev,
    status: 'CLOSED',
    settled: true,
    result: { sold: event.sold, finalPriceCents: event.finalPriceCents, winnerPseudonym: event.winnerPseudonym },
    serverOffsetMs: Date.parse(event.serverNow) - Date.now(),
  };
}

export function applyCanceledEvent(prev: LotRoomData, event: LotCanceledEvent): LotRoomData {
  if (event.lotId !== prev.id) return prev;
  return { ...prev, status: 'CANCELED', serverOffsetMs: Date.parse(event.serverNow) - Date.now() };
}

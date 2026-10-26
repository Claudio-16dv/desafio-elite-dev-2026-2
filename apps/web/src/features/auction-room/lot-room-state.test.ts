import { describe, expect, it } from 'vitest';
import type { LotViewerState, PublicBid } from '@/types/api';
import {
  applyBidEvent,
  applyCanceledEvent,
  applyClosedEvent,
  countBidders,
  deriveViewerState,
  type LotRoomData,
} from './lot-room-state';

const ANA = 'Licitante AAAAAA';
const BRUNO = 'Licitante BBBBBB';

const bid = (sequence: number, bidderPseudonym: string, amountCents: number): PublicBid => ({
  sequence,
  amountCents,
  bidderPseudonym,
  placedAt: '2026-10-24T12:00:00.000Z',
  hash: `h${sequence}`,
  prevHash: `h${sequence - 1}`,
});

const viewer = (pseudonym: string, overrides: Partial<LotViewerState> = {}): LotViewerState => ({
  role: 'BIDDER',
  isOwner: false,
  pseudonym,
  isLeading: false,
  highestBidCents: null,
  position: null,
  receiptCode: null,
  ...overrides,
});

function room(overrides: Partial<LotRoomData> = {}): LotRoomData {
  return {
    id: 'lot-1',
    title: 'Lote',
    subtitle: null,
    description: null,
    imageUrl: 'x',
    attributes: [],
    source: 'x',
    sourceUrl: null,
    status: 'LIVE',
    settled: false,
    startingBidCents: 10_000,
    minIncrementCents: 1_000,
    startsAt: '2026-10-24T11:00:00.000Z',
    endsAt: '2026-10-24T13:00:00.000Z',
    originalEndsAt: '2026-10-24T13:00:00.000Z',
    extended: false,
    currentBidCents: 11_000,
    minimumNextBidCents: 12_000,
    bidCount: 2,
    leaderPseudonym: BRUNO,
    sellerPseudonym: 'Leiloeiro CCCCCC',
    result: null,
    bids: [bid(1, ANA, 10_000), bid(2, BRUNO, 11_000)],
    me: viewer(ANA, { highestBidCents: 10_000, position: 2 }),
    serverNow: '2026-10-24T12:00:00.000Z',
    serverOffsetMs: 0,
    ...overrides,
  };
}

const event = (sequence: number, by: string, amount: number, extra = {}) => ({
  lotId: 'lot-1',
  bid: bid(sequence, by, amount),
  currentBidCents: amount,
  bidCount: sequence,
  minimumNextBidCents: amount + 1_000,
  leaderPseudonym: by,
  endsAt: '2026-10-24T13:00:00.000Z',
  extended: false,
  serverNow: '2026-10-24T12:00:05.000Z',
  ...extra,
});

describe('deriveViewerState', () => {
  it('marca líder, melhor lance e posição', () => {
    const bids = [bid(1, ANA, 10_000), bid(2, BRUNO, 11_000), bid(3, ANA, 12_000)];
    expect(deriveViewerState(viewer(ANA), bids, ANA)).toMatchObject({ isLeading: true, highestBidCents: 12_000, position: 1 });
    expect(deriveViewerState(viewer(BRUNO), bids, ANA)).toMatchObject({ isLeading: false, highestBidCents: 11_000, position: 2 });
  });

  it('quem nunca deu lance fica sem posição', () => {
    expect(deriveViewerState(viewer('Licitante ZZZZZZ'), [bid(1, ANA, 10_000)], ANA)).toMatchObject({
      isLeading: false,
      highestBidCents: null,
      position: null,
    });
  });

  it('o leiloeiro dono nunca "lidera"', () => {
    const owner = viewer('Leiloeiro CCCCCC', { role: 'AUCTIONEER', isOwner: true });
    expect(deriveViewerState(owner, [bid(1, ANA, 10_000)], 'Leiloeiro CCCCCC').isLeading).toBe(false);
  });
});

describe('applyBidEvent', () => {
  it('atualiza lance atual, líder, histórico e a situação do usuário (foi superado -> ganhando)', () => {
    const next = applyBidEvent(room(), event(3, ANA, 12_000));
    expect(next).toMatchObject({ currentBidCents: 12_000, bidCount: 3, leaderPseudonym: ANA, minimumNextBidCents: 13_000 });
    expect(next.bids).toHaveLength(3);
    expect(next.me).toMatchObject({ isLeading: true, position: 1, highestBidCents: 12_000 });
  });

  it('quando outro cobre o lance, o usuário deixa de ser o líder', () => {
    const leading = room({ leaderPseudonym: ANA, me: viewer(ANA, { isLeading: true, highestBidCents: 11_000, position: 1 }) });
    const next = applyBidEvent(leading, event(3, BRUNO, 12_000));
    expect(next.me).toMatchObject({ isLeading: false, position: 2 });
  });

  it('é idempotente: o mesmo lance duas vezes não duplica', () => {
    const once = applyBidEvent(room(), event(3, ANA, 12_000));
    expect(applyBidEvent(once, event(3, ANA, 12_000))).toBe(once);
  });

  it('lance antigo chegando atrasado entra no histórico sem sobrescrever o estado atual', () => {
    const current = room({ bidCount: 3, currentBidCents: 12_000, bids: [bid(1, ANA, 10_000), bid(3, ANA, 12_000)], leaderPseudonym: ANA });
    const next = applyBidEvent(current, event(2, BRUNO, 11_000));
    expect(next.bids.map((b) => b.sequence)).toEqual([1, 2, 3]);
    expect(next.currentBidCents).toBe(12_000);
    expect(next.leaderPseudonym).toBe(ANA);
  });

  it('propaga a prorrogação (anti-sniping) e guarda que o lote foi estendido', () => {
    const next = applyBidEvent(room(), event(3, ANA, 12_000, { extended: true, endsAt: '2026-10-24T13:02:00.000Z' }));
    expect(next.extended).toBe(true);
    expect(next.endsAt).toBe('2026-10-24T13:02:00.000Z');
  });

  it('ignora eventos de outro lote', () => {
    const current = room();
    expect(applyBidEvent(current, { ...event(3, ANA, 12_000), lotId: 'outro' })).toBe(current);
  });

  it('visitante (sem "me") continua sem "me"', () => {
    expect(applyBidEvent(room({ me: null }), event(3, ANA, 12_000)).me).toBeNull();
  });
});

describe('applyClosedEvent / applyCanceledEvent', () => {
  it('encerra com resultado', () => {
    const next = applyClosedEvent(room(), {
      lotId: 'lot-1',
      sold: true,
      finalPriceCents: 11_000,
      winnerPseudonym: BRUNO,
      serverNow: '2026-10-24T13:00:01.000Z',
    });
    expect(next).toMatchObject({ status: 'CLOSED', settled: true, result: { sold: true, finalPriceCents: 11_000, winnerPseudonym: BRUNO } });
  });

  it('cancela', () => {
    expect(applyCanceledEvent(room(), { lotId: 'lot-1', serverNow: '2026-10-24T12:30:00.000Z' }).status).toBe('CANCELED');
  });
});

describe('countBidders', () => {
  it('conta licitantes distintos', () => {
    expect(countBidders([bid(1, ANA, 1), bid(2, BRUNO, 2), bid(3, ANA, 3)])).toBe(2);
  });
});

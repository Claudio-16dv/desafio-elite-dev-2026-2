import {
  ChainBid,
  ChainLot,
  GENESIS_HASH,
  computeBidHash,
  computeLotSeal,
  computeReceiptSeal,
  verifyBidChain,
} from './hash-chain';
import { pseudonymFor } from './pseudonym';

const SECRET = 'segredo-de-teste-com-mais-de-16-chars';
const LOT_ID = '11111111-1111-4111-8111-111111111111';
const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRUNO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Monta uma cadeia válida com N lances alternando entre Ana e Bruno. */
function buildChain(count: number): { lot: ChainLot; bids: ChainBid[] } {
  const bids: ChainBid[] = [];
  let prevHash = GENESIS_HASH;
  for (let i = 1; i <= count; i++) {
    const bidderId = i % 2 === 1 ? ANA : BRUNO;
    const amountCents = 10_000 + i * 1_000;
    const placedAt = new Date(Date.UTC(2026, 9, 24, 12, i, 0, 123));
    const hash = computeBidHash(SECRET, { lotId: LOT_ID, sequence: i, bidderId, amountCents, placedAt, prevHash });
    bids.push({ sequence: i, bidderId, amountCents, placedAt, prevHash, hash });
    prevHash = hash;
  }
  const last = bids[bids.length - 1];
  const lot: ChainLot = {
    id: LOT_ID,
    sellerId: SELLER,
    startingBidCents: 10_000,
    minIncrementCents: 1_000,
    startsAt: new Date(Date.UTC(2026, 9, 24, 12, 0, 0, 0)),
    originalEndsAt: new Date(Date.UTC(2026, 9, 24, 13, 0, 0, 0)),
    endsAt: new Date(Date.UTC(2026, 9, 24, 13, 0, 0, 0)),
    bidCount: bids.length,
    chainHeadHash: last?.hash ?? null,
    currentBidCents: last?.amountCents ?? null,
    leaderId: last?.bidderId ?? null,
    chainSeal: '',
    settledAt: null,
    winnerId: null,
    finalPriceCents: null,
  };
  lot.chainSeal = computeLotSeal(SECRET, lot);
  return { lot, bids };
}

const clone = <T>(value: T): T => structuredClone(value);
const codes = (result: ReturnType<typeof verifyBidChain>) => result.issues.map((i) => i.code);

describe('verifyBidChain', () => {
  it('aceita uma cadeia íntegra', () => {
    const { lot, bids } = buildChain(5);
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result).toMatchObject({ valid: true, checkedBids: 5, issues: [], headHash: bids[4].hash });
  });

  it('aceita lote sem lances', () => {
    const { lot, bids } = buildChain(0);
    expect(verifyBidChain(SECRET, lot, bids).valid).toBe(true);
  });

  it('detecta alteração do valor de um lance', () => {
    const { lot, bids } = buildChain(4);
    bids[1].amountCents = 1; // adulteração direta no banco
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BID_HASH_MISMATCH', sequence: 2 }));
  });

  it('detecta troca do autor de um lance', () => {
    const { lot, bids } = buildChain(3);
    bids[2].bidderId = BRUNO;
    expect(codes(verifyBidChain(SECRET, lot, bids))).toContain('BID_HASH_MISMATCH');
  });

  it('detecta alteração do instante de um lance', () => {
    const { lot, bids } = buildChain(3);
    bids[0].placedAt = new Date(bids[0].placedAt.getTime() + 1);
    expect(codes(verifyBidChain(SECRET, lot, bids))).toContain('BID_HASH_MISMATCH');
  });

  it('detecta lance removido do meio da cadeia', () => {
    const { lot, bids } = buildChain(5);
    bids.splice(2, 1);
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining(['SEQUENCE_GAP', 'CHAIN_LINK_BROKEN', 'LOT_SUMMARY_MISMATCH']));
  });

  it('detecta lance inserido depois do fato', () => {
    const { lot, bids } = buildChain(3);
    const fake: ChainBid = {
      sequence: 4,
      bidderId: BRUNO,
      amountCents: 99_999,
      placedAt: new Date(),
      prevHash: bids[2].hash,
      hash: 'f'.repeat(64),
    };
    expect(verifyBidChain(SECRET, lot, [...bids, fake]).valid).toBe(false);
  });

  it('detecta remoção do ÚLTIMO lance (cadeia continua consistente, mas o resumo do lote não)', () => {
    const { lot, bids } = buildChain(4);
    bids.pop();
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('LOT_SUMMARY_MISMATCH');
  });

  it('detecta remoção do último lance mesmo que o atacante ajuste o resumo do lote (selo HMAC)', () => {
    const { lot, bids } = buildChain(4);
    bids.pop();
    const last = bids[bids.length - 1];
    // atacante reescreve o resumo para ficar consistente, mas não tem o segredo para refazer o selo
    lot.bidCount = bids.length;
    lot.chainHeadHash = last.hash;
    lot.currentBidCents = last.amountCents;
    lot.leaderId = last.bidderId;
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual(['LOT_SEAL_MISMATCH']);
  });

  it('um atacante com acesso só ao banco não consegue recalcular a cadeia sem o segredo', () => {
    const { lot, bids } = buildChain(3);
    const forged = clone(bids);
    forged[1].amountCents = 50_000;
    // tenta "consertar" com SHA/HMAC usando outro segredo
    let prev = GENESIS_HASH;
    for (const bid of forged) {
      bid.prevHash = prev;
      bid.hash = computeBidHash('segredo-errado-do-atacante', { lotId: LOT_ID, ...bid, prevHash: prev });
      prev = bid.hash;
    }
    expect(verifyBidChain(SECRET, lot, forged).valid).toBe(false);
  });

  it('detecta mudança do líder/lance atual direto na tabela do lote', () => {
    const { lot, bids } = buildChain(3);
    lot.leaderId = BRUNO === lot.leaderId ? ANA : BRUNO;
    const result = verifyBidChain(SECRET, lot, bids);
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining(['LOT_SUMMARY_MISMATCH', 'LOT_SEAL_MISMATCH']));
  });

  it('detecta alteração das regras do lote (fim, lance inicial, incremento) direto no banco', () => {
    for (const tamper of [
      (lot: ChainLot) => (lot.endsAt = new Date(lot.endsAt.getTime() - 60_000)),
      (lot: ChainLot) => (lot.startingBidCents = 1),
      (lot: ChainLot) => (lot.minIncrementCents = 1),
      (lot: ChainLot) => (lot.sellerId = ANA),
    ]) {
      const { lot, bids } = buildChain(2);
      tamper(lot);
      expect(codes(verifyBidChain(SECRET, lot, bids))).toEqual(['LOT_SEAL_MISMATCH']);
    }
  });

  it('confere o resultado da liquidação contra a cadeia', () => {
    const { lot, bids } = buildChain(3);
    lot.settledAt = new Date();
    lot.winnerId = bids[2].bidderId;
    lot.finalPriceCents = bids[2].amountCents;
    expect(verifyBidChain(SECRET, lot, bids).valid).toBe(true);

    lot.finalPriceCents = 1; // preço final adulterado
    expect(codes(verifyBidChain(SECRET, lot, bids))).toEqual(['LOT_RESULT_MISMATCH']);
  });

  it('segredos diferentes produzem hashes diferentes', () => {
    const input = { lotId: LOT_ID, sequence: 1, bidderId: ANA, amountCents: 1, placedAt: new Date(0), prevHash: GENESIS_HASH };
    expect(computeBidHash('segredo-aaaaaaaaaaaa', input)).not.toBe(computeBidHash('segredo-bbbbbbbbbbbb', input));
  });
});

describe('computeReceiptSeal', () => {
  const input = {
    code: 'abc123XYZ',
    lotId: LOT_ID,
    winnerId: ANA,
    sellerId: BRUNO,
    finalPriceCents: 150_000,
    bidCount: 3,
    chainHeadHash: 'a'.repeat(64),
    issuedAt: new Date('2026-10-24T12:00:00.000Z'),
  };

  it('muda se qualquer campo do comprovante mudar', () => {
    const original = computeReceiptSeal(SECRET, input);
    expect(computeReceiptSeal(SECRET, { ...input, finalPriceCents: 1 })).not.toBe(original);
    expect(computeReceiptSeal(SECRET, { ...input, winnerId: BRUNO })).not.toBe(original);
    expect(computeReceiptSeal(SECRET, { ...input, bidCount: 4 })).not.toBe(original);
  });
});

describe('pseudonymFor', () => {
  it('é estável dentro do mesmo lote', () => {
    expect(pseudonymFor(SECRET, 'bidder', LOT_ID, ANA)).toBe(pseudonymFor(SECRET, 'bidder', LOT_ID, ANA));
  });

  it('é diferente entre licitantes e entre lotes (sem rastreio cruzado)', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    expect(pseudonymFor(SECRET, 'bidder', LOT_ID, ANA)).not.toBe(pseudonymFor(SECRET, 'bidder', LOT_ID, BRUNO));
    expect(pseudonymFor(SECRET, 'bidder', LOT_ID, ANA)).not.toBe(pseudonymFor(SECRET, 'bidder', other, ANA));
  });

  it('não contém o id do usuário', () => {
    const pseudonym = pseudonymFor(SECRET, 'bidder', LOT_ID, ANA);
    expect(pseudonym).toMatch(/^Licitante [0-9A-F]{6}$/);
    expect(pseudonym).not.toContain('aaaaaaaa');
  });

  it('usa prefixo próprio para o leiloeiro', () => {
    expect(pseudonymFor(SECRET, 'seller', LOT_ID, BRUNO)).toMatch(/^Leiloeiro [0-9A-F]{6}$/);
  });
});

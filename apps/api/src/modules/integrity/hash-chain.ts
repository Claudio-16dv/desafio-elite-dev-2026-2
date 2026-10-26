/**
 * Cadeia de hashes à prova de adulteração (funções puras, sem I/O).
 *
 * Técnica: cada lance guarda `hash = HMAC-SHA256(segredo, campos do lance + hash do lance anterior)`.
 * O primeiro lance encadeia com GENESIS_HASH. Isso forma uma cadeia por lote:
 *
 *   GENESIS -> [lance 1] -> [lance 2] -> [lance 3] ...
 *
 * - Alterar valor/licitante/instante de um lance muda o hash esperado dele (BID_HASH_MISMATCH).
 * - Remover ou inserir um lance no meio quebra a numeração e o encadeamento
 *   (SEQUENCE_GAP / CHAIN_LINK_BROKEN).
 * - Recalcular a cadeia inteira exigiria o segredo (AUDIT_SECRET), que NÃO está no banco.
 *   Por isso usamos HMAC e não um SHA-256 simples: quem só tem acesso ao banco não consegue
 *   "consertar" os hashes depois de mexer nos dados.
 * - Remover os ÚLTIMOS lances deixaria a cadeia consistente; por isso o lote guarda um
 *   "selo" (HMAC) do seu resumo (contagem, hash da cabeça, lance atual, líder) que também é conferido.
 * - O mesmo selo cobre as REGRAS do lote que dão sentido aos lances (leiloeiro, lance inicial,
 *   incremento, início, fim original e fim atual). Mudar o fim direto no banco (por exemplo,
 *   "desfazer" uma prorrogação) também é detectado.
 * - O resultado gravado na liquidação (vencedor e preço) é conferido contra a própria cadeia.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface BidHashInput {
  lotId: string;
  sequence: number;
  bidderId: string;
  amountCents: number;
  placedAt: Date;
  prevHash: string;
}

/** Campos do lote cobertos pelo selo (mesmos nomes das colunas da tabela "Lot"). */
export interface LotSealInput {
  id: string;
  sellerId: string;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: Date;
  originalEndsAt: Date;
  endsAt: Date;
  bidCount: number;
  chainHeadHash: string | null;
  currentBidCents: number | null;
  leaderId: string | null;
}

export interface ReceiptSealInput {
  code: string;
  lotId: string;
  winnerId: string;
  sellerId: string;
  finalPriceCents: number;
  bidCount: number;
  chainHeadHash: string;
  issuedAt: Date;
}

export function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/** Comparação em tempo constante de dois hashes hexadecimais. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function computeBidHash(secret: string, input: BidHashInput): string {
  const payload = [
    'bid',
    'v1',
    input.lotId,
    input.sequence,
    input.bidderId,
    input.amountCents,
    input.placedAt.toISOString(),
    input.prevHash,
  ].join('|');
  return hmacHex(secret, payload);
}

export function computeLotSeal(secret: string, input: LotSealInput): string {
  const payload = [
    'lot',
    'v2',
    input.id,
    input.sellerId,
    input.startingBidCents,
    input.minIncrementCents,
    input.startsAt.toISOString(),
    input.originalEndsAt.toISOString(),
    input.endsAt.toISOString(),
    input.bidCount,
    input.chainHeadHash ?? '-',
    input.currentBidCents ?? '-',
    input.leaderId ?? '-',
  ].join('|');
  return hmacHex(secret, payload);
}

export function computeReceiptSeal(secret: string, input: ReceiptSealInput): string {
  const payload = [
    'receipt',
    'v1',
    input.code,
    input.lotId,
    input.winnerId,
    input.sellerId,
    input.finalPriceCents,
    input.bidCount,
    input.chainHeadHash,
    input.issuedAt.toISOString(),
  ].join('|');
  return hmacHex(secret, payload);
}

export interface ChainBid {
  sequence: number;
  bidderId: string;
  amountCents: number;
  placedAt: Date;
  prevHash: string;
  hash: string;
}

export interface ChainLot extends LotSealInput {
  chainSeal: string;
  /** Resultado da liquidação (conferido contra a cadeia). */
  settledAt: Date | null;
  winnerId: string | null;
  finalPriceCents: number | null;
}

export type IntegrityIssueCode =
  | 'SEQUENCE_GAP'
  | 'CHAIN_LINK_BROKEN'
  | 'BID_HASH_MISMATCH'
  | 'LOT_SUMMARY_MISMATCH'
  | 'LOT_SEAL_MISMATCH'
  | 'LOT_RESULT_MISMATCH'
  | 'RECEIPT_SEAL_MISMATCH'
  | 'RECEIPT_LOT_MISMATCH';

export interface IntegrityIssue {
  code: IntegrityIssueCode;
  message: string;
  /** Número do lance afetado, quando aplicável. */
  sequence?: number;
}

export interface ChainVerification {
  valid: boolean;
  checkedBids: number;
  headHash: string | null;
  issues: IntegrityIssue[];
}

/**
 * Reconfere toda a cadeia de um lote. `bids` deve vir ordenado por `sequence`.
 * Nunca lança: devolve a lista de problemas encontrados.
 */
export function verifyBidChain(secret: string, lot: ChainLot, bids: ChainBid[]): ChainVerification {
  const issues: IntegrityIssue[] = [];
  const ordered = [...bids].sort((a, b) => a.sequence - b.sequence);
  let expectedPrev = GENESIS_HASH;

  ordered.forEach((bid, index) => {
    const expectedSequence = index + 1;

    if (bid.sequence !== expectedSequence) {
      issues.push({
        code: 'SEQUENCE_GAP',
        sequence: bid.sequence,
        message: `Numeração inconsistente: era esperado o lance #${expectedSequence}, mas foi encontrado o #${bid.sequence}. Há lance removido ou inserido.`,
      });
    }

    if (!safeEqualHex(bid.prevHash, expectedPrev)) {
      issues.push({
        code: 'CHAIN_LINK_BROKEN',
        sequence: bid.sequence,
        message: `O lance #${bid.sequence} não se encadeia com o lance anterior.`,
      });
    }

    const expectedHash = computeBidHash(secret, {
      lotId: lot.id,
      sequence: bid.sequence,
      bidderId: bid.bidderId,
      amountCents: bid.amountCents,
      placedAt: bid.placedAt,
      prevHash: bid.prevHash,
    });
    if (!safeEqualHex(bid.hash, expectedHash)) {
      issues.push({
        code: 'BID_HASH_MISMATCH',
        sequence: bid.sequence,
        message: `O conteúdo do lance #${bid.sequence} foi alterado depois de registrado.`,
      });
    }

    // Segue a cadeia pelo hash armazenado para localizar o problema no lance exato.
    expectedPrev = bid.hash;
  });

  const last = ordered[ordered.length - 1];
  const expectedHead = last ? last.hash : null;

  if (lot.bidCount !== ordered.length) {
    issues.push({
      code: 'LOT_SUMMARY_MISMATCH',
      message: `O lote registra ${lot.bidCount} lance(s), mas o histórico tem ${ordered.length}.`,
    });
  }
  if (lot.chainHeadHash !== expectedHead) {
    issues.push({
      code: 'LOT_SUMMARY_MISMATCH',
      message: 'O último hash registrado no lote não corresponde ao último lance do histórico.',
    });
  }
  if (lot.currentBidCents !== (last ? last.amountCents : null)) {
    issues.push({
      code: 'LOT_SUMMARY_MISMATCH',
      message: 'O lance atual do lote não corresponde ao último lance do histórico.',
    });
  }
  if (lot.leaderId !== (last ? last.bidderId : null)) {
    issues.push({
      code: 'LOT_SUMMARY_MISMATCH',
      message: 'O líder do lote não corresponde ao autor do último lance do histórico.',
    });
  }

  if (!safeEqualHex(lot.chainSeal, computeLotSeal(secret, lot))) {
    issues.push({
      code: 'LOT_SEAL_MISMATCH',
      message:
        'O selo de integridade do lote não confere: o resumo ou as regras do lote (valores, datas, leiloeiro) foram modificados.',
    });
  }

  // Resultado da liquidação: o vencedor é o autor do último lance e o preço é o valor dele.
  const expectedWinner = lot.settledAt && last ? last.bidderId : null;
  const expectedPrice = lot.settledAt && last ? last.amountCents : null;
  if (lot.winnerId !== expectedWinner || lot.finalPriceCents !== expectedPrice) {
    issues.push({
      code: 'LOT_RESULT_MISMATCH',
      message: 'O resultado registrado no lote (vencedor ou preço final) não corresponde ao histórico de lances.',
    });
  }

  return {
    valid: issues.length === 0,
    checkedBids: ordered.length,
    headHash: expectedHead,
    issues,
  };
}

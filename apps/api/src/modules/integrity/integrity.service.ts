import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BidHashInput,
  ChainBid,
  ChainLot,
  ChainVerification,
  LotSealInput,
  ReceiptSealInput,
  computeBidHash,
  computeLotSeal,
  computeReceiptSeal,
  verifyBidChain,
} from './hash-chain';
import { PseudonymKind, pseudonymFor } from './pseudonym';

/**
 * Fachada injetável das funções de integridade: guarda o segredo (AUDIT_SECRET)
 * para que nenhum outro módulo precise conhecê-lo.
 */
@Injectable()
export class IntegrityService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('AUDIT_SECRET');
  }

  bidHash(input: BidHashInput): string {
    return computeBidHash(this.secret, input);
  }

  lotSeal(input: LotSealInput): string {
    return computeLotSeal(this.secret, input);
  }

  receiptSeal(input: ReceiptSealInput): string {
    return computeReceiptSeal(this.secret, input);
  }

  verifyChain(lot: ChainLot, bids: ChainBid[]): ChainVerification {
    return verifyBidChain(this.secret, lot, bids);
  }

  pseudonym(kind: PseudonymKind, lotId: string, userId: string): string {
    return pseudonymFor(this.secret, kind, lotId, userId);
  }
}

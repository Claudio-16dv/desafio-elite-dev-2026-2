import { Injectable } from '@nestjs/common';
import { Bid, Lot } from '@prisma/client';
import { ItemAttribute } from '../catalog/catalog.types';
import { IntegrityService } from '../integrity/integrity.service';
import { PublicBid } from '../realtime/realtime.events';
import { minimumNextBidCents } from '../bids/bid-rules';
import { deriveLotStatus } from './lot-status';
import { LotResult, LotSummaryView } from './lot-view.types';

/**
 * Converte entidades do banco em visões públicas. É o ÚNICO ponto onde ids de
 * usuário viram pseudônimos, garantindo que nenhum endpoint vaze dados pessoais.
 */
@Injectable()
export class LotViewMapper {
  constructor(private readonly integrity: IntegrityService) {}

  toSummary(lot: Lot, now: Date): LotSummaryView {
    const status = deriveLotStatus(lot, now);
    return {
      id: lot.id,
      title: lot.title,
      subtitle: lot.subtitle,
      description: lot.description,
      imageUrl: lot.imageUrl,
      attributes: lot.attributes as unknown as ItemAttribute[],
      source: lot.source,
      sourceUrl: lot.sourceUrl,
      status,
      settled: lot.settledAt !== null,
      startingBidCents: lot.startingBidCents,
      minIncrementCents: lot.minIncrementCents,
      startsAt: lot.startsAt.toISOString(),
      endsAt: lot.endsAt.toISOString(),
      originalEndsAt: lot.originalEndsAt.toISOString(),
      extended: lot.endsAt > lot.originalEndsAt,
      currentBidCents: lot.currentBidCents,
      minimumNextBidCents: minimumNextBidCents(lot),
      bidCount: lot.bidCount,
      leaderPseudonym: lot.leaderId ? this.integrity.pseudonym('bidder', lot.id, lot.leaderId) : null,
      sellerPseudonym: this.integrity.pseudonym('seller', lot.id, lot.sellerId),
      result: this.toResult(lot),
    };
  }

  toResult(lot: Lot): LotResult | null {
    if (!lot.settledAt || lot.canceledAt) return null;
    return {
      sold: lot.winnerId !== null,
      finalPriceCents: lot.finalPriceCents,
      winnerPseudonym: lot.winnerId ? this.integrity.pseudonym('bidder', lot.id, lot.winnerId) : null,
    };
  }

  toPublicBid(bid: Bid): PublicBid {
    return {
      sequence: bid.sequence,
      amountCents: bid.amountCents,
      placedAt: bid.placedAt.toISOString(),
      bidderPseudonym: this.integrity.pseudonym('bidder', bid.lotId, bid.bidderId),
      hash: bid.hash,
      prevHash: bid.prevHash,
    };
  }
}

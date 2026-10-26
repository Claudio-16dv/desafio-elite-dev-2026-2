import { HttpStatus, Injectable } from '@nestjs/common';
import { Lot, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { Clock } from '../../common/clock';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { IntegrityService } from '../integrity/integrity.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletLedger, WalletSummary } from '../wallet/wallet-ledger';
import { CreateLotDto, ListLotsDto } from './dto/lots.dto';
import { LotViewMapper } from './lot-view.mapper';
import {
  LotDetailView,
  LotSummaryView,
  LotViewerState,
  Paginated,
} from './lot-view.types';

/** Início no passado é tolerado até este limite (relógio do navegador desregulado). */
const START_TOLERANCE_MS = 5 * 60 * 1000;
const MIN_DURATION_MS = 60 * 1000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_START_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export interface SellerSummary {
  totalReceivedCents: number;
  soldCount: number;
  unsoldCount: number;
  liveCount: number;
  scheduledCount: number;
  canceledCount: number;
}

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly catalog: CatalogService,
    private readonly integrity: IntegrityService,
    private readonly ledger: WalletLedger,
    private readonly realtime: RealtimeService,
    private readonly mapper: LotViewMapper,
  ) {}

  // ---------------------------------------------------------------- vitrine

  /** Vitrine pública: ao vivo, agendados ou encerrados. Lotes cancelados nunca aparecem. */
  async list(query: ListLotsDto): Promise<Paginated<LotSummaryView>> {
    const now = this.clock.now();
    const where = this.whereForStatus(query.status, now);
    if (query.q) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { subtitle: { contains: query.q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, lots] = await this.prisma.$transaction([
      this.prisma.lot.count({ where }),
      this.prisma.lot.findMany({
        where,
        orderBy: this.orderFor(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: lots.map((lot) => this.mapper.toSummary(lot, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      serverNow: now.toISOString(),
    };
  }

  private whereForStatus(
    status: ListLotsDto['status'],
    now: Date,
  ): Prisma.LotWhereInput & { AND?: Prisma.LotWhereInput[] } {
    switch (status) {
      case 'live':
        return { canceledAt: null, startsAt: { lte: now }, endsAt: { gt: now } };
      case 'scheduled':
        return { canceledAt: null, startsAt: { gt: now } };
      case 'closed':
        return { canceledAt: null, endsAt: { lte: now } };
    }
  }

  private orderFor(query: ListLotsDto): Prisma.LotOrderByWithRelationInput[] {
    switch (query.sort) {
      case 'newest':
        return [{ createdAt: 'desc' }];
      case 'most_bids':
        return [{ bidCount: 'desc' }, { endsAt: 'asc' }];
      case 'ending_soon':
        return [{ endsAt: 'asc' }];
      default:
        // Padrão por aba: ao vivo = quem acaba primeiro; agendados = quem começa primeiro;
        // encerrados = os mais recentes primeiro.
        if (query.status === 'scheduled') return [{ startsAt: 'asc' }];
        if (query.status === 'closed') return [{ endsAt: 'desc' }];
        return [{ endsAt: 'asc' }];
    }
  }

  // ---------------------------------------------------------------- detalhe

  /** Sala do lote. Pública; se houver login, inclui a situação do usuário. */
  async getDetail(lotId: string, viewer?: AuthenticatedUser): Promise<LotDetailView> {
    const now = this.clock.now();
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { receipt: { select: { code: true } }, bids: { orderBy: { sequence: 'asc' } } },
    });
    if (!lot) throw this.notFound();

    const { bids, receipt, ...lotRow } = lot;
    return {
      ...this.mapper.toSummary(lotRow, now),
      bids: bids.map((bid) => this.mapper.toPublicBid(bid)),
      me: viewer ? this.buildViewerState(lotRow, bids, viewer, receipt?.code ?? null) : null,
      serverNow: now.toISOString(),
    };
  }

  private buildViewerState(
    lot: Lot,
    bids: Array<{ bidderId: string; amountCents: number }>,
    viewer: AuthenticatedUser,
    receiptCode: string | null,
  ): LotViewerState {
    const bestByBidder = new Map<string, number>();
    for (const bid of bids) {
      bestByBidder.set(bid.bidderId, Math.max(bestByBidder.get(bid.bidderId) ?? 0, bid.amountCents));
    }
    const ranking = [...bestByBidder.entries()].sort((a, b) => b[1] - a[1]);
    const index = ranking.findIndex(([bidderId]) => bidderId === viewer.id);

    return {
      role: viewer.role,
      isOwner: lot.sellerId === viewer.id,
      pseudonym:
        lot.sellerId === viewer.id
          ? this.integrity.pseudonym('seller', lot.id, viewer.id)
          : this.integrity.pseudonym('bidder', lot.id, viewer.id),
      isLeading: lot.leaderId === viewer.id,
      highestBidCents: bestByBidder.get(viewer.id) ?? null,
      position: index === -1 ? null : index + 1,
      receiptCode: lot.winnerId === viewer.id ? receiptCode : null,
    };
  }

  // ---------------------------------------------------------------- criação

  async create(sellerId: string, dto: CreateLotDto): Promise<LotSummaryView> {
    const now = this.clock.now();
    const { startsAt, endsAt } = this.validateSchedule(dto, now);

    // Snapshot: o servidor busca o item e grava uma cópia no lote. Depois disso,
    // o lote não depende mais da API externa.
    const item = await this.catalog.getItem(dto.externalId);

    const id = randomUUID();
    const lot = await this.prisma.lot.create({
      data: {
        id,
        sellerId,
        source: item.source,
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        title: dto.title || item.title,
        subtitle: item.subtitle,
        description: dto.description || null,
        imageUrl: item.imageUrl,
        attributes: item.attributes as unknown as Prisma.InputJsonValue,
        startingBidCents: dto.startingBidCents,
        minIncrementCents: dto.minIncrementCents,
        startsAt,
        originalEndsAt: endsAt,
        endsAt,
        bidCount: 0,
        chainSeal: this.integrity.lotSeal({
          id,
          sellerId,
          startingBidCents: dto.startingBidCents,
          minIncrementCents: dto.minIncrementCents,
          startsAt,
          originalEndsAt: endsAt,
          endsAt,
          bidCount: 0,
          chainHeadHash: null,
          currentBidCents: null,
          leaderId: null,
        }),
      },
    });
    return this.mapper.toSummary(lot, now);
  }

  private validateSchedule(dto: CreateLotDto, now: Date): { startsAt: Date; endsAt: Date } {
    const invalid = (message: string) =>
      new DomainException('INVALID_LOT_SCHEDULE', message, HttpStatus.UNPROCESSABLE_ENTITY);

    let startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw invalid('Datas inválidas.');
    }
    if (startsAt.getTime() < now.getTime() - START_TOLERANCE_MS) {
      throw invalid('O início do lote não pode estar no passado.');
    }
    // Pequena defasagem para trás (relógio do navegador) vira "começa agora".
    if (startsAt < now) startsAt = now;
    if (startsAt.getTime() > now.getTime() + MAX_START_AHEAD_MS) {
      throw invalid('O início do lote deve ser em até 1 ano.');
    }
    const durationMs = endsAt.getTime() - startsAt.getTime();
    if (durationMs < MIN_DURATION_MS) {
      throw invalid('O lote precisa durar pelo menos 1 minuto.');
    }
    if (durationMs > MAX_DURATION_MS) {
      throw invalid('O lote pode durar no máximo 30 dias.');
    }
    return { startsAt, endsAt };
  }

  // ------------------------------------------------------------ cancelamento

  /**
   * Cancela um lote ainda não encerrado. Se já houver líder, o valor comprometido dele
   * é liberado automaticamente (estorno) na MESMA transação do cancelamento.
   */
  async cancel(sellerId: string, lotId: string): Promise<LotSummaryView> {
    const now = this.clock.now();

    const { lot, refundedLeaderId, refundedWallet } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId}::uuid FOR UPDATE`;
      const current = await tx.lot.findUnique({ where: { id: lotId } });
      if (!current || current.sellerId !== sellerId) throw this.notFound();

      if (current.canceledAt) {
        throw new DomainException(
          'LOT_ALREADY_CANCELED',
          'Este lote já foi cancelado.',
          HttpStatus.CONFLICT,
        );
      }
      if (current.settledAt || now >= current.endsAt) {
        throw new DomainException(
          'LOT_ALREADY_ENDED',
          'Este lote já terminou e não pode mais ser cancelado.',
          HttpStatus.CONFLICT,
        );
      }

      let wallet: WalletSummary | null = null;
      let leaderId: string | null = null;
      if (current.leaderId && current.currentBidCents) {
        leaderId = current.leaderId;
        await this.ledger.lock(tx, [leaderId]);
        wallet = await this.ledger.release(tx, leaderId, current.currentBidCents);
      }

      const canceled = await tx.lot.update({ where: { id: lotId }, data: { canceledAt: now } });
      return { lot: canceled, refundedLeaderId: leaderId, refundedWallet: wallet };
    });

    this.realtime.lotCanceled({ lotId, serverNow: now.toISOString() });
    if (refundedLeaderId && refundedWallet) {
      this.realtime.walletUpdated(refundedLeaderId, refundedWallet);
    }
    return this.mapper.toSummary(lot, now);
  }

  // ------------------------------------------------------- painel do leiloeiro

  /** Todos os lotes do leiloeiro (inclusive cancelados), mais recentes primeiro. */
  async listForSeller(sellerId: string): Promise<{ items: LotSummaryView[]; serverNow: string }> {
    const now = this.clock.now();
    const lots = await this.prisma.lot.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { items: lots.map((lot) => this.mapper.toSummary(lot, now)), serverNow: now.toISOString() };
  }

  async sellerSummary(sellerId: string): Promise<SellerSummary> {
    const now = this.clock.now();
    const [sales, soldCount, unsoldCount, liveCount, scheduledCount, canceledCount] =
      await this.prisma.$transaction([
        this.prisma.lot.aggregate({
          where: { sellerId, winnerId: { not: null }, canceledAt: null },
          _sum: { finalPriceCents: true },
        }),
        this.prisma.lot.count({ where: { sellerId, winnerId: { not: null }, canceledAt: null } }),
        this.prisma.lot.count({
          where: { sellerId, settledAt: { not: null }, winnerId: null, canceledAt: null },
        }),
        this.prisma.lot.count({
          where: { sellerId, canceledAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
        }),
        this.prisma.lot.count({ where: { sellerId, canceledAt: null, startsAt: { gt: now } } }),
        this.prisma.lot.count({ where: { sellerId, canceledAt: { not: null } } }),
      ]);

    return {
      totalReceivedCents: sales._sum.finalPriceCents ?? 0,
      soldCount,
      unsoldCount,
      liveCount,
      scheduledCount,
      canceledCount,
    };
  }

  private notFound(): DomainException {
    return new DomainException('LOT_NOT_FOUND', 'Lote não encontrado.', HttpStatus.NOT_FOUND);
  }
}

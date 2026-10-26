import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../prisma/prisma.service';
import { BidsService } from '../../modules/bids/bids.service';
import { FALLBACK_CATALOG } from '../../modules/catalog/fallback-catalog';
import { CatalogItem } from '../../modules/catalog/catalog.types';
import { IntegrityService } from '../../modules/integrity/integrity.service';
import { SettlementService } from '../../modules/settlement/settlement.service';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DemoAccount } from './seed.data';

type AccountIds = Record<DemoAccount['key'], string>;

interface DemoBid {
  by: 'bidder1' | 'bidder2';
  amountCents: number;
  minutesFromNow: number;
}

interface DemoLot {
  itemIndex: number;
  startsInMinutes: number;
  endsInMinutes: number;
  startingBidCents: number;
  minIncrementCents: number;
  note?: string;
  bids: DemoBid[];
}

const MINUTE = 60_000;

/**
 * Dados de demonstração: 1 leiloeiro, 2 licitantes e lotes em cada situação
 * (ao vivo com lances, agendado e encerrado com comprovante).
 *
 * É IDEMPOTENTE e roda a cada boot quando SEED_ON_BOOT=true:
 *  - contas já existentes não são recriadas;
 *  - se não houver nenhum lote em andamento/agendado do leiloeiro demo (ex.: os de ontem
 *    já terminaram), cria novos, para que sempre exista algo ao vivo para testar;
 *  - todos os lances passam por BidsService/SettlementService, então a cadeia de hashes,
 *    os saldos comprometidos e o comprovante são REAIS (nada é inserido "no braço").
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly clock: Clock,
    private readonly integrity: IntegrityService,
    private readonly bids: BidsService,
    private readonly settlement: SettlementService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('SEED_ON_BOOT') !== 'true') return;
    try {
      await this.run();
    } catch (error) {
      this.logger.error('Falha ao popular dados de demonstração', error instanceof Error ? error.stack : String(error));
    }
  }

  async run(options: { reset?: boolean } = {}): Promise<void> {
    if (options.reset) await this.reset();
    const accounts = await this.ensureAccounts();
    await this.ensureLiveAndScheduledLots(accounts);
    await this.ensureSoldLot(accounts);
    this.logger.log('Dados de demonstração prontos');
  }

  /** APAGA TUDO. Só é chamado pela CLI com --reset. */
  private async reset(): Promise<void> {
    this.logger.warn('Limpando todas as tabelas (--reset)');
    await this.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Receipt", "Bid", "WalletTransaction", "Lot", "Wallet", "User" RESTART IDENTITY CASCADE',
    );
  }

  private async ensureAccounts(): Promise<AccountIds> {
    const ids = {} as AccountIds;
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    for (const account of DEMO_ACCOUNTS) {
      const existing = await this.prisma.user.findUnique({ where: { email: account.email } });
      if (existing) {
        ids[account.key] = existing.id;
        continue;
      }
      const created = await this.prisma.user.create({
        data: {
          name: account.name,
          email: account.email,
          passwordHash,
          role: account.role,
          wallet: {
            create: {
              balanceCents: account.initialBalanceCents,
              transactions:
                account.initialBalanceCents > 0
                  ? {
                      create: {
                        type: 'DEPOSIT',
                        amountCents: account.initialBalanceCents,
                        balanceAfterCents: account.initialBalanceCents,
                      },
                    }
                  : undefined,
            },
          },
        },
      });
      ids[account.key] = created.id;
      this.logger.log(`Conta demo criada: ${account.email}`);
    }
    return ids;
  }

  private async ensureLiveAndScheduledLots(accounts: AccountIds): Promise<void> {
    const now = this.clock.now();
    const open = await this.prisma.lot.count({
      where: { sellerId: accounts.seller, canceledAt: null, endsAt: { gt: now } },
    });
    if (open > 0) return;

    const demos: DemoLot[] = [
      {
        // Ao vivo, com disputa: licitante1 lidera, licitante2 foi superado.
        itemIndex: 0,
        startsInMinutes: -30,
        endsInMinutes: 6 * 60,
        startingBidCents: 150_000,
        minIncrementCents: 10_000,
        note: 'Lote de demonstração com lances abertos.',
        bids: [
          { by: 'bidder1', amountCents: 160_000, minutesFromNow: -25 },
          { by: 'bidder2', amountCents: 180_000, minutesFromNow: -20 },
          { by: 'bidder1', amountCents: 200_000, minutesFromNow: -10 },
        ],
      },
      {
        // Ao vivo, licitante2 lidera.
        itemIndex: 4,
        startsInMinutes: -60,
        endsInMinutes: 2 * 24 * 60,
        startingBidCents: 500_000,
        minIncrementCents: 25_000,
        bids: [{ by: 'bidder2', amountCents: 500_000, minutesFromNow: -50 }],
      },
      {
        // Agendado: começa em 1 hora.
        itemIndex: 7,
        startsInMinutes: 60,
        endsInMinutes: 25 * 60,
        startingBidCents: 80_000,
        minIncrementCents: 5_000,
        bids: [],
      },
    ];
    for (const demo of demos) await this.createDemoLot(accounts, demo, now);
  }

  private async ensureSoldLot(accounts: AccountIds): Promise<void> {
    const sold = await this.prisma.lot.count({
      where: { sellerId: accounts.seller, winnerId: { not: null } },
    });
    if (sold > 0) return;

    const now = this.clock.now();
    const lotId = await this.createDemoLot(
      accounts,
      {
        // Já encerrado: liquidado de verdade, com comprovante.
        itemIndex: 9,
        startsInMinutes: -180,
        endsInMinutes: -60,
        startingBidCents: 100_000,
        minIncrementCents: 10_000,
        note: 'Lote encerrado de demonstração (com comprovante).',
        bids: [
          { by: 'bidder1', amountCents: 100_000, minutesFromNow: -170 },
          { by: 'bidder2', amountCents: 120_000, minutesFromNow: -150 },
          { by: 'bidder1', amountCents: 150_000, minutesFromNow: -100 },
        ],
      },
      now,
    );
    await this.settlement.settleLot(lotId);
  }

  private async createDemoLot(accounts: AccountIds, demo: DemoLot, now: Date): Promise<string> {
    const item: CatalogItem = FALLBACK_CATALOG[demo.itemIndex % FALLBACK_CATALOG.length];
    const id = randomUUID();
    const endsAt = new Date(now.getTime() + demo.endsInMinutes * MINUTE);
    const startsAt = new Date(now.getTime() + demo.startsInMinutes * MINUTE);

    await this.prisma.lot.create({
      data: {
        id,
        sellerId: accounts.seller,
        source: item.source,
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        subtitle: item.subtitle,
        description: demo.note ?? null,
        imageUrl: item.imageUrl,
        attributes: item.attributes as unknown as Prisma.InputJsonValue,
        startingBidCents: demo.startingBidCents,
        minIncrementCents: demo.minIncrementCents,
        startsAt,
        originalEndsAt: endsAt,
        endsAt,
        bidCount: 0,
        chainSeal: this.integrity.lotSeal({
          id,
          sellerId: accounts.seller,
          startingBidCents: demo.startingBidCents,
          minIncrementCents: demo.minIncrementCents,
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

    for (const bid of demo.bids) {
      await this.bids.placeBid(
        accounts[bid.by],
        id,
        bid.amountCents,
        new Date(now.getTime() + bid.minutesFromNow * MINUTE),
      );
    }
    return id;
  }
}

/**
 * Teste de integração do fluxo completo do leilão, contra um PostgreSQL real
 * (banco `leilao_test`): regras de lance, saldo comprometido, concorrência, cancelamento,
 * anti-sniping, liquidação, comprovante, auditoria e detecção de adulteração.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://leilao:leilao@127.0.0.1:5432/leilao_test?schema=public';
process.env.JWT_SECRET = 'segredo-jwt-apenas-para-testes-123';
process.env.AUDIT_SECRET = 'segredo-auditoria-apenas-para-testes-123';
process.env.SEED_ON_BOOT = 'false';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { io as connect, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/errors/validation.pipe';
import { BidsService } from '../src/modules/bids/bids.service';
import { FALLBACK_CATALOG } from '../src/modules/catalog/fallback-catalog';
import { IntegrityService } from '../src/modules/integrity/integrity.service';
import { SettlementService } from '../src/modules/settlement/settlement.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestUser {
  id: string;
  token: string;
  email: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Fluxo completo do leilão (integração)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let baseUrl: string;
  let prisma: PrismaService;
  let auth: AuthService;
  let integrity: IntegrityService;
  let bids: BidsService;
  let settlement: SettlementService;

  const tag = randomUUID().slice(0, 8);
  const catalogItem = FALLBACK_CATALOG[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.listen(0);
    baseUrl = await app.getUrl();
    http = request(app.getHttpServer());

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    integrity = app.get(IntegrityService);
    bids = app.get(BidsService);
    settlement = app.get(SettlementService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ------------------------------------------------------------------ helpers

  async function newUser(role: Role, label: string): Promise<TestUser> {
    const email = `${label}-${tag}-${randomUUID().slice(0, 4)}@teste.dev`;
    const session = await auth.register({ name: `Usuário ${label}`, email, password: 'senha-segura-123', role });
    return { id: session.user.id, token: session.accessToken, email };
  }

  const authed = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function deposit(user: TestUser, amountCents: number) {
    await http.post('/wallet/deposit').set(authed(user)).send({ amountCents }).expect(200);
  }

  async function wallet(user: TestUser) {
    const { body } = await http.get('/wallet').set(authed(user)).expect(200);
    const { balanceCents, committedCents, availableCents } = body as {
      balanceCents: number;
      committedCents: number;
      availableCents: number;
    };
    return { balanceCents, committedCents, availableCents };
  }

  /** Cria um lote direto no banco (permite janelas de tempo curtas/passadas). */
  async function createLotDirect(
    sellerId: string,
    opts: { startsInMs: number; endsInMs: number; startingBidCents?: number; minIncrementCents?: number },
  ): Promise<string> {
    const id = randomUUID();
    const now = Date.now();
    const endsAt = new Date(now + opts.endsInMs);
    const rules = {
      id,
      sellerId,
      startingBidCents: opts.startingBidCents ?? 10_000,
      minIncrementCents: opts.minIncrementCents ?? 1_000,
      startsAt: new Date(now + opts.startsInMs),
      originalEndsAt: endsAt,
      endsAt,
    };
    await prisma.lot.create({
      data: {
        ...rules,
        source: catalogItem.source,
        externalId: catalogItem.externalId,
        title: `Lote de teste ${tag}`,
        subtitle: catalogItem.subtitle,
        imageUrl: catalogItem.imageUrl,
        attributes: catalogItem.attributes as never,
        chainSeal: integrity.lotSeal({
          ...rules,
          bidCount: 0,
          chainHeadHash: null,
          currentBidCents: null,
          leaderId: null,
        }),
      },
    });
    return id;
  }

  async function bid(user: TestUser, lotId: string, amountCents: number) {
    return http.post(`/lots/${lotId}/bids`).set(authed(user)).send({ amountCents });
  }

  const audit = async (lotId: string) => (await http.get(`/audit/lots/${lotId}`).expect(200)).body;

  // -------------------------------------------------------------------- testes

  it('valida entradas e devolve erros no formato padrão em português', async () => {
    const res = await http.post('/auth/register').send({ name: 'X', email: 'nao-e-email', password: '123', role: 'BIDDER' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.message).toBe('string');

    const extra = await http.post('/auth/login').send({ email: 'a@b.com', password: 'x', admin: true });
    expect(extra.status).toBe(400);
  });

  it('cadastra, faz login e não repete e-mails', async () => {
    const email = `cadastro-${tag}@teste.dev`;
    const body = { name: 'Fulana de Tal', email, password: 'senha-segura-123', role: 'BIDDER' };
    const created = await http.post('/auth/register').send(body).expect(201);
    expect(created.body.accessToken).toEqual(expect.any(String));
    expect(created.body.user).toMatchObject({ email, role: 'BIDDER' });

    const dup = await http.post('/auth/register').send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_ALREADY_REGISTERED');

    await http.post('/auth/login').send({ email, password: 'senha-segura-123' }).expect(200);
    const wrong = await http.post('/auth/login').send({ email, password: 'errada-123456' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });

  describe('regras de lance, saldo comprometido, concorrência e cancelamento', () => {
    let seller: TestUser;
    let otherSeller: TestUser;
    let ana: TestUser;
    let bruno: TestUser;
    let carla: TestUser;
    let poor: TestUser;
    let lotId: string;

    beforeAll(async () => {
      seller = await newUser('AUCTIONEER', 'leiloeiro');
      otherSeller = await newUser('AUCTIONEER', 'leiloeiro2');
      [ana, bruno, carla, poor] = await Promise.all([
        newUser('BIDDER', 'ana'),
        newUser('BIDDER', 'bruno'),
        newUser('BIDDER', 'carla'),
        newUser('BIDDER', 'pobre'),
      ]);
      await Promise.all([deposit(ana, 100_000), deposit(bruno, 100_000), deposit(carla, 100_000), deposit(poor, 5_000)]);

      const now = Date.now();
      const created = await http
        .post('/lots')
        .set(authed(seller))
        .send({
          externalId: catalogItem.externalId,
          startingBidCents: 10_000,
          minIncrementCents: 1_000,
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + 10 * 60_000).toISOString(),
        })
        .expect(201);
      lotId = created.body.id;
      expect(created.body.title).toBe(catalogItem.title); // snapshot gravado pelo servidor
    });

    it('somente leiloeiro cria lote e somente licitante deposita/dá lance', async () => {
      await http.post('/lots').set(authed(ana)).send({}).expect(403);
      await http.post('/wallet/deposit').set(authed(seller)).send({ amountCents: 1000 }).expect(403);
      const sellerBid = await bid(seller, lotId, 20_000);
      expect(sellerBid.status).toBe(403);
      const anonymous = await http.post(`/lots/${lotId}/bids`).send({ amountCents: 20_000 });
      expect(anonymous.status).toBe(401);
    });

    it('lote criado aparece na vitrine "ao vivo" com busca', async () => {
      const { body } = await http.get('/lots').query({ status: 'live', q: catalogItem.title.slice(0, 12) }).expect(200);
      expect(body.items.map((l: { id: string }) => l.id)).toContain(lotId);
      const scheduled = await http.get('/lots').query({ status: 'scheduled' }).expect(200);
      expect(scheduled.body.items.map((l: { id: string }) => l.id)).not.toContain(lotId);
    });

    it('recusa lances inválidos com o motivo correto', async () => {
      const below = await bid(ana, lotId, 9_000);
      expect(below.status).toBe(422);
      expect(below.body).toMatchObject({ code: 'BID_BELOW_MINIMUM', details: { minimumBidCents: 10_000 } });

      const noFunds = await bid(poor, lotId, 10_000);
      expect(noFunds.status).toBe(422);
      expect(noFunds.body.code).toBe('INSUFFICIENT_BALANCE');
      expect(noFunds.body.message).toContain('Saldo insuficiente');
    });

    it('aceita o primeiro lance, compromete o saldo e impede o líder de cobrir a si mesmo', async () => {
      const ok = await bid(ana, lotId, 10_000);
      expect(ok.status).toBe(201);
      expect(ok.body.lot).toMatchObject({ currentBidCents: 10_000, bidCount: 1, minimumNextBidCents: 11_000 });
      expect(await wallet(ana)).toEqual({ balanceCents: 100_000, committedCents: 10_000, availableCents: 90_000 });

      const self = await bid(ana, lotId, 20_000);
      expect(self.status).toBe(422);
      expect(self.body.code).toBe('ALREADY_LEADING');

      const tooLow = await bid(bruno, lotId, 10_500);
      expect(tooLow.body.code).toBe('BID_BELOW_MINIMUM');
    });

    it('ao ser superado, o valor comprometido volta imediatamente ao disponível', async () => {
      const ok = await bid(bruno, lotId, 11_000);
      expect(ok.status).toBe(201);
      expect(await wallet(ana)).toEqual({ balanceCents: 100_000, committedCents: 0, availableCents: 100_000 });
      expect(await wallet(bruno)).toEqual({ balanceCents: 100_000, committedCents: 11_000, availableCents: 89_000 });
    });

    it('mostra a situação do usuário (ganhando/superado/posição) e não vaza dados pessoais', async () => {
      const asAna = (await http.get(`/lots/${lotId}`).set(authed(ana)).expect(200)).body;
      expect(asAna.me).toMatchObject({ isLeading: false, position: 2, highestBidCents: 10_000, isOwner: false });
      const asBruno = (await http.get(`/lots/${lotId}`).set(authed(bruno)).expect(200)).body;
      expect(asBruno.me).toMatchObject({ isLeading: true, position: 1 });
      expect(asBruno.leaderPseudonym).toBe(asBruno.me.pseudonym);

      const anonymous = (await http.get(`/lots/${lotId}`).expect(200)).body;
      expect(anonymous.me).toBeNull();
      const raw = JSON.stringify(anonymous);
      for (const user of [ana, bruno, seller]) {
        expect(raw).not.toContain(user.id);
        expect(raw).not.toContain(user.email);
      }
    });

    it('lances simultâneos no mesmo valor: exatamente um é aceito e nada fica inconsistente', async () => {
      // Ana e Carla disparam o mesmo valor ao mesmo tempo; o lote estava em 11.000.
      const [a, c] = await Promise.all([bid(ana, lotId, 12_000), bid(carla, lotId, 12_000)]);
      expect([a.status, c.status].sort()).toEqual([201, 422]);
      const rejected = a.status === 422 ? a : c;
      expect(rejected.body.code).toBe('BID_BELOW_MINIMUM');

      const detail = (await http.get(`/lots/${lotId}`).expect(200)).body;
      expect(detail.bidCount).toBe(3);
      expect(detail.currentBidCents).toBe(12_000);

      // Invariante: a soma do comprometido de todos == lance atual (só o líder compromete).
      const wallets = await Promise.all([ana, bruno, carla].map(wallet));
      expect(wallets.reduce((sum, w) => sum + w.committedCents, 0)).toBe(12_000);
      wallets.forEach((w) => expect(w.availableCents).toBe(w.balanceCents - w.committedCents));

      const report = await audit(lotId);
      expect(report.integrity).toMatchObject({ status: 'INTACT', valid: true, checkedBids: 3 });
    });

    it('apenas o dono cancela; cancelar com lances estorna o líder e some da vitrine', async () => {
      const notOwner = await http.post(`/lots/${lotId}/cancel`).set(authed(otherSeller));
      expect(notOwner.status).toBe(404);
      const byBidder = await http.post(`/lots/${lotId}/cancel`).set(authed(ana));
      expect(byBidder.status).toBe(403);

      const committedBefore = (await Promise.all([ana, carla].map(wallet))).reduce((s, w) => s + w.committedCents, 0);
      expect(committedBefore).toBe(12_000);

      const canceled = await http.post(`/lots/${lotId}/cancel`).set(authed(seller)).expect(200);
      expect(canceled.body.status).toBe('CANCELED');

      const committedAfter = (await Promise.all([ana, bruno, carla].map(wallet))).reduce((s, w) => s + w.committedCents, 0);
      expect(committedAfter).toBe(0);

      const live = await http.get('/lots').query({ status: 'live', q: catalogItem.title.slice(0, 12) }).expect(200);
      expect(live.body.items.map((l: { id: string }) => l.id)).not.toContain(lotId);

      const again = await http.post(`/lots/${lotId}/cancel`).set(authed(seller));
      expect(again.status).toBe(409);
      const lateBid = await bid(bruno, lotId, 50_000);
      expect(lateBid.body.code).toBe('LOT_CANCELED');
    });

    it('recusa lance em lote agendado e em lote encerrado', async () => {
      const scheduled = await createLotDirect(seller.id, { startsInMs: 3_600_000, endsInMs: 7_200_000 });
      expect((await bid(ana, scheduled, 10_000)).body.code).toBe('LOT_NOT_STARTED');

      const ended = await createLotDirect(seller.id, { startsInMs: -7_200_000, endsInMs: -3_600_000 });
      expect((await bid(ana, ended, 10_000)).body.code).toBe('LOT_ENDED');
    });
  });

  describe('anti-sniping, auditoria e adulteração', () => {
    let seller: TestUser;
    let ana: TestUser;
    let bruno: TestUser;
    let lotId: string;

    beforeAll(async () => {
      seller = await newUser('AUCTIONEER', 'leiloeiro-snipe');
      ana = await newUser('BIDDER', 'ana-snipe');
      bruno = await newUser('BIDDER', 'bruno-snipe');
      await Promise.all([deposit(ana, 100_000), deposit(bruno, 100_000)]);
      lotId = await createLotDirect(seller.id, { startsInMs: -60_000, endsInMs: 90_000 });
    });

    it('lance nos últimos 2 minutos prorroga o fim do lote para agora + 2 min', async () => {
      const before = Date.now();
      const res = await bid(ana, lotId, 10_000);
      expect(res.status).toBe(201);
      expect(res.body.lot.extended).toBe(true);
      const newEnd = new Date(res.body.lot.endsAt).getTime();
      expect(newEnd).toBeGreaterThanOrEqual(before + 120_000);
      expect(newEnd).toBeLessThanOrEqual(Date.now() + 120_000);

      const detail = (await http.get(`/lots/${lotId}`).expect(200)).body;
      expect(detail.extended).toBe(true);
      expect(new Date(detail.originalEndsAt).getTime()).toBeLessThan(new Date(detail.endsAt).getTime());

      await bid(bruno, lotId, 11_000).then((r) => expect(r.status).toBe(201));
    });

    it('a auditoria é pública, identifica por pseudônimo e confirma a integridade', async () => {
      const report = await audit(lotId);
      expect(report.integrity).toMatchObject({ status: 'INTACT', checkedBids: 2, issues: [] });
      expect(report.bids).toHaveLength(2);
      expect(report.bids[0].bidderPseudonym).toMatch(/^Licitante [0-9A-F]{6}$/);
      const raw = JSON.stringify(report);
      for (const user of [ana, bruno, seller]) {
        expect(raw).not.toContain(user.id);
        expect(raw).not.toContain(user.email);
      }
    });

    it('detecta alteração de valor feita direto no banco (e volta a ficar íntegro ao restaurar)', async () => {
      const original = await prisma.bid.findFirstOrThrow({ where: { lotId, sequence: 1 } });
      await prisma.bid.update({ where: { id: original.id }, data: { amountCents: 1 } });

      const tampered = await audit(lotId);
      expect(tampered.integrity.status).toBe('TAMPERED');
      expect(tampered.integrity.issues).toContainEqual(expect.objectContaining({ code: 'BID_HASH_MISMATCH', sequence: 1 }));

      await prisma.bid.update({ where: { id: original.id }, data: { amountCents: original.amountCents } });
      expect((await audit(lotId)).integrity.status).toBe('INTACT');
    });

    it('detecta alteração das regras do lote direto no banco (ex.: desfazer a prorrogação)', async () => {
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      await prisma.lot.update({ where: { id: lotId }, data: { endsAt: lot.originalEndsAt } });

      const tampered = await audit(lotId);
      expect(tampered.integrity.status).toBe('TAMPERED');
      expect(tampered.integrity.issues).toContainEqual(expect.objectContaining({ code: 'LOT_SEAL_MISMATCH' }));

      await prisma.lot.update({ where: { id: lotId }, data: { endsAt: lot.endsAt } });
      expect((await audit(lotId)).integrity.status).toBe('INTACT');
    });

    it('detecta remoção do último lance e inserção de lance falso', async () => {
      const last = await prisma.bid.findFirstOrThrow({ where: { lotId, sequence: 2 } });
      await prisma.bid.delete({ where: { id: last.id } });
      const removed = await audit(lotId);
      expect(removed.integrity.status).toBe('TAMPERED');
      expect(removed.integrity.issues.map((i: { code: string }) => i.code)).toContain('LOT_SUMMARY_MISMATCH');
      await prisma.bid.create({ data: last });
      expect((await audit(lotId)).integrity.status).toBe('INTACT');

      const fake = await prisma.bid.create({
        data: {
          lotId,
          bidderId: ana.id,
          sequence: 3,
          amountCents: 99_000,
          placedAt: new Date(),
          prevHash: last.hash,
          hash: 'f'.repeat(64),
        },
      });
      expect((await audit(lotId)).integrity.status).toBe('TAMPERED');
      await prisma.bid.delete({ where: { id: fake.id } });
      expect((await audit(lotId)).integrity.status).toBe('INTACT');
    });
  });

  describe('liquidação e comprovante', () => {
    let seller: TestUser;
    let ana: TestUser;
    let bruno: TestUser;
    let lotId: string;

    beforeAll(async () => {
      seller = await newUser('AUCTIONEER', 'leiloeiro-liq');
      ana = await newUser('BIDDER', 'ana-liq');
      bruno = await newUser('BIDDER', 'bruno-liq');
      await Promise.all([deposit(ana, 100_000), deposit(bruno, 100_000)]);
      // O lote encerra em ~2s; os lances são registrados "no passado" para não acionar o anti-sniping.
      lotId = await createLotDirect(seller.id, { startsInMs: -600_000, endsInMs: 2_000 });
      await bids.placeBid(ana.id, lotId, 20_000, new Date(Date.now() - 300_000));
      await bids.placeBid(bruno.id, lotId, 25_000, new Date(Date.now() - 240_000));
    });

    it('debita o vencedor, credita o leiloeiro, libera os demais e emite o comprovante (uma única vez)', async () => {
      await sleep(2_500);
      const first = await settlement.settleLot(lotId);
      // O agendador pode ter liquidado antes; em qualquer caso o resultado final é o mesmo.
      expect(['SOLD', 'SKIPPED']).toContain(first.kind);
      expect((await settlement.settleLot(lotId)).kind).toBe('SKIPPED'); // idempotente

      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot).toMatchObject({ winnerId: bruno.id, finalPriceCents: 25_000 });
      expect(lot.settledAt).not.toBeNull();

      expect(await wallet(bruno)).toEqual({ balanceCents: 75_000, committedCents: 0, availableCents: 75_000 });
      expect(await wallet(ana)).toEqual({ balanceCents: 100_000, committedCents: 0, availableCents: 100_000 });
      expect(await wallet(seller)).toEqual({ balanceCents: 25_000, committedCents: 0, availableCents: 25_000 });

      const receipts = await prisma.receipt.findMany({ where: { lotId } });
      expect(receipts).toHaveLength(1);
    });

    it('mostra o resultado na vitrine de encerrados, em "meus arremates" e no painel do leiloeiro', async () => {
      const closed = (await http.get('/lots').query({ status: 'closed', q: `Lote de teste ${tag}` }).expect(200)).body;
      const entry = closed.items.find((l: { id: string }) => l.id === lotId);
      expect(entry.result).toMatchObject({ sold: true, finalPriceCents: 25_000 });

      const mine = (await http.get('/bidder/participations').set(authed(bruno)).expect(200)).body;
      const won = mine.items.find((p: { lot: { id: string } }) => p.lot.id === lotId);
      expect(won).toMatchObject({ status: 'WON', myHighestBidCents: 25_000 });
      expect(won.receiptCode).toEqual(expect.any(String));

      const lost = (await http.get('/bidder/participations').set(authed(ana)).expect(200)).body;
      expect(lost.items.find((p: { lot: { id: string } }) => p.lot.id === lotId)).toMatchObject({
        status: 'LOST',
        receiptCode: null,
      });

      const summary = (await http.get('/seller/summary').set(authed(seller)).expect(200)).body;
      expect(summary).toMatchObject({ totalReceivedCents: 25_000, soldCount: 1 });
    });

    it('o comprovante é público por link, íntegro e sem dados pessoais', async () => {
      const code = (await prisma.receipt.findUniqueOrThrow({ where: { lotId } })).code;
      const { body } = await http.get(`/receipts/${code}`).expect(200);
      expect(body).toMatchObject({ finalPriceCents: 25_000, bidCount: 2, integrity: { status: 'INTACT' } });
      expect(body.winnerPseudonym).toMatch(/^Licitante /);

      const raw = JSON.stringify(body);
      for (const user of [ana, bruno, seller]) {
        expect(raw).not.toContain(user.id);
        expect(raw).not.toContain(user.email);
      }

      await http.get('/receipts/codigo-que-nao-existe').expect(404);
      await http.get('/receipts/!!').expect(404);
    });

    it('detecta comprovante e histórico adulterados direto no banco', async () => {
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { lotId } });

      await prisma.receipt.update({ where: { id: receipt.id }, data: { finalPriceCents: 1 } });
      const forged = (await http.get(`/receipts/${receipt.code}`).expect(200)).body;
      expect(forged.integrity.status).toBe('TAMPERED');
      expect(forged.integrity.issues.map((i: { code: string }) => i.code)).toContain('RECEIPT_SEAL_MISMATCH');
      await prisma.receipt.update({ where: { id: receipt.id }, data: { finalPriceCents: receipt.finalPriceCents } });

      const firstBid = await prisma.bid.findFirstOrThrow({ where: { lotId, sequence: 1 } });
      await prisma.bid.update({ where: { id: firstBid.id }, data: { amountCents: 123 } });
      expect((await http.get(`/receipts/${receipt.code}`).expect(200)).body.integrity.status).toBe('TAMPERED');
      await prisma.bid.update({ where: { id: firstBid.id }, data: { amountCents: firstBid.amountCents } });
      expect((await http.get(`/receipts/${receipt.code}`).expect(200)).body.integrity.status).toBe('INTACT');
    });

    it('lote sem lances fecha sem vencedor e não gera comprovante', async () => {
      const empty = await createLotDirect(seller.id, { startsInMs: -600_000, endsInMs: 1_000 });
      await sleep(1_500);
      const outcome = await settlement.settleLot(empty);
      expect(['UNSOLD', 'SKIPPED']).toContain(outcome.kind);
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: empty } });
      expect(lot.settledAt).not.toBeNull();
      expect(lot.winnerId).toBeNull();
      expect(await prisma.receipt.count({ where: { lotId: empty } })).toBe(0);
    });

    it('não liquida automaticamente um lote cujo histórico foi adulterado', async () => {
      const lot = await createLotDirect(seller.id, { startsInMs: -600_000, endsInMs: 1_500 });
      await bids.placeBid(ana.id, lot, 30_000, new Date(Date.now() - 300_000));
      const bid1 = await prisma.bid.findFirstOrThrow({ where: { lotId: lot } });
      await prisma.bid.update({ where: { id: bid1.id }, data: { amountCents: 5 } });
      await sleep(2_000);

      const outcome = await settlement.settleLot(lot);
      expect(outcome.kind).toBe('TAMPERED');
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot } })).settledAt).toBeNull();
      expect((await wallet(ana)).committedCents).toBe(30_000); // dinheiro intocado
    });
  });

  describe('tempo real (WebSocket)', () => {
    it('entrega lances no lote e eventos privados de carteira/superado', async () => {
      const seller = await newUser('AUCTIONEER', 'leiloeiro-ws');
      const ana = await newUser('BIDDER', 'ana-ws');
      const bruno = await newUser('BIDDER', 'bruno-ws');
      await Promise.all([deposit(ana, 100_000), deposit(bruno, 100_000)]);
      const lotId = await createLotDirect(seller.id, { startsInMs: -60_000, endsInMs: 3_600_000 });

      const watcher: Socket = connect(`${baseUrl}/realtime`, { transports: ['websocket'] });
      const anaSocket: Socket = connect(`${baseUrl}/realtime`, { transports: ['websocket'], auth: { token: ana.token } });
      try {
        const lotBid = new Promise<{ currentBidCents: number; leaderPseudonym: string }>((resolve) =>
          watcher.once('lot:bid', resolve),
        );
        const outbid = new Promise<{ newAmountCents: number }>((resolve) => anaSocket.once('bid:outbid', resolve));
        const walletEvent = new Promise<{ committedCents: number }>((resolve) => anaSocket.once('wallet:updated', resolve));

        await Promise.all([
          new Promise<void>((resolve) => watcher.once('connect', () => resolve())),
          new Promise<void>((resolve) => anaSocket.once('connect', () => resolve())),
        ]);
        watcher.emit('lot:join', lotId);
        await sleep(300);

        await bid(ana, lotId, 10_000).then((r) => expect(r.status).toBe(201));
        await bid(bruno, lotId, 12_000).then((r) => expect(r.status).toBe(201));

        expect((await lotBid).currentBidCents).toBeGreaterThanOrEqual(10_000);
        expect((await walletEvent).committedCents).toBeGreaterThanOrEqual(0);
        expect((await outbid).newAmountCents).toBe(12_000);
      } finally {
        watcher.close();
        anaSocket.close();
      }
    });
  });
});

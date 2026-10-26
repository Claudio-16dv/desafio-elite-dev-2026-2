import { BiddableLot, evaluateBid, minimumNextBidCents } from './bid-rules';

const T0 = new Date('2026-10-24T12:00:00.000Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

function lot(overrides: Partial<BiddableLot> = {}): BiddableLot {
  return {
    sellerId: 'seller',
    startsAt: minutes(-10),
    endsAt: minutes(60),
    canceledAt: null,
    settledAt: null,
    startingBidCents: 10_000,
    minIncrementCents: 1_000,
    currentBidCents: null,
    leaderId: null,
    ...overrides,
  };
}

const base = { bidderId: 'ana', availableCents: 1_000_000, now: T0 };

describe('minimumNextBidCents', () => {
  it('é o lance inicial enquanto não há lances', () => {
    expect(minimumNextBidCents(lot())).toBe(10_000);
  });

  it('é o lance atual + incremento mínimo depois do primeiro lance', () => {
    expect(minimumNextBidCents(lot({ currentBidCents: 15_000 }))).toBe(16_000);
  });
});

describe('evaluateBid', () => {
  it('aceita o primeiro lance igual ao lance inicial', () => {
    expect(evaluateBid({ ...base, lot: lot(), amountCents: 10_000 })).toEqual({ ok: true });
  });

  it('recusa o primeiro lance abaixo do lance inicial', () => {
    const result = evaluateBid({ ...base, lot: lot(), amountCents: 9_999 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'BID_BELOW_MINIMUM' } });
    if (!result.ok) expect(result.rejection.details.minimumBidCents).toBe(10_000);
  });

  it('aceita lance seguinte exatamente igual ao atual + incremento', () => {
    const current = lot({ currentBidCents: 20_000, leaderId: 'bruno' });
    expect(evaluateBid({ ...base, lot: current, amountCents: 21_000 })).toEqual({ ok: true });
  });

  it('recusa lance seguinte abaixo do atual + incremento', () => {
    const current = lot({ currentBidCents: 20_000, leaderId: 'bruno' });
    const result = evaluateBid({ ...base, lot: current, amountCents: 20_999 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'BID_BELOW_MINIMUM' } });
  });

  it('recusa quando o licitante já é o líder (não pode cobrir o próprio lance)', () => {
    const current = lot({ currentBidCents: 20_000, leaderId: 'ana' });
    const result = evaluateBid({ ...base, lot: current, amountCents: 50_000 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'ALREADY_LEADING' } });
  });

  it('recusa por saldo insuficiente quando o lance não cabe no disponível', () => {
    const result = evaluateBid({ ...base, lot: lot(), amountCents: 10_000, availableCents: 9_999 });
    expect(result).toMatchObject({
      ok: false,
      rejection: { code: 'INSUFFICIENT_BALANCE', details: { availableCents: 9_999, requiredCents: 10_000 } },
    });
  });

  it('aceita quando o lance é exatamente o saldo disponível', () => {
    expect(
      evaluateBid({ ...base, lot: lot(), amountCents: 10_000, availableCents: 10_000 }),
    ).toEqual({ ok: true });
  });

  it('recusa lote que ainda não começou', () => {
    const result = evaluateBid({ ...base, lot: lot({ startsAt: minutes(5) }), amountCents: 10_000 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'LOT_NOT_STARTED' } });
  });

  it('aceita no instante exato de início', () => {
    expect(
      evaluateBid({ ...base, lot: lot({ startsAt: T0 }), amountCents: 10_000 }),
    ).toEqual({ ok: true });
  });

  it('recusa no instante exato do fim e depois dele', () => {
    const atEnd = evaluateBid({ ...base, lot: lot({ endsAt: T0 }), amountCents: 10_000 });
    expect(atEnd).toMatchObject({ ok: false, rejection: { code: 'LOT_ENDED' } });
    const after = evaluateBid({ ...base, lot: lot({ endsAt: minutes(-1) }), amountCents: 10_000 });
    expect(after).toMatchObject({ ok: false, rejection: { code: 'LOT_ENDED' } });
  });

  it('recusa lote já liquidado mesmo que o horário ainda não tenha vencido', () => {
    const result = evaluateBid({ ...base, lot: lot({ settledAt: minutes(-1) }), amountCents: 10_000 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'LOT_ENDED' } });
  });

  it('recusa lote cancelado (prioridade sobre as demais regras)', () => {
    const result = evaluateBid({
      ...base,
      lot: lot({ canceledAt: minutes(-2), startsAt: minutes(5) }),
      amountCents: 1,
    });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'LOT_CANCELED' } });
  });

  it('prioriza "você já está ganhando" sobre "abaixo do mínimo"', () => {
    const current = lot({ currentBidCents: 20_000, leaderId: 'ana' });
    const result = evaluateBid({ ...base, lot: current, amountCents: 1 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'ALREADY_LEADING' } });
  });

  it('prioriza "abaixo do mínimo" sobre "saldo insuficiente"', () => {
    const result = evaluateBid({ ...base, lot: lot(), amountCents: 5_000, availableCents: 0 });
    expect(result).toMatchObject({ ok: false, rejection: { code: 'BID_BELOW_MINIMUM' } });
  });

  it('as mensagens estão em português e citam valores formatados em reais', () => {
    const result = evaluateBid({ ...base, lot: lot(), amountCents: 5_000 });
    if (result.ok) throw new Error('esperava recusa');
    expect(result.rejection.message).toContain('Lance abaixo do mínimo');
    expect(result.rejection.message).toMatch(/R\$\s?100,00/);
  });
});

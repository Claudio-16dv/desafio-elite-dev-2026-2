import { ANTI_SNIPING_WINDOW_MS, applyAntiSniping } from './anti-sniping';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('applyAntiSniping', () => {
  it('não prorroga quando faltam mais de 2 minutos', () => {
    const endsAt = at(ANTI_SNIPING_WINDOW_MS + 1);
    expect(applyAntiSniping(endsAt, NOW)).toEqual({ endsAt, extended: false });
  });

  it('prorroga quando faltam exatamente 2 minutos (borda inclusiva)', () => {
    const result = applyAntiSniping(at(ANTI_SNIPING_WINDOW_MS), NOW);
    // agora + 2min == fim atual: não encurta e não avança -> sem mudança real
    expect(result.endsAt.getTime()).toBe(at(ANTI_SNIPING_WINDOW_MS).getTime());
    expect(result.extended).toBe(false);
  });

  it('prorroga para agora + 2 minutos quando faltam menos de 2 minutos', () => {
    const result = applyAntiSniping(at(30_000), NOW);
    expect(result.extended).toBe(true);
    expect(result.endsAt.getTime()).toBe(NOW.getTime() + ANTI_SNIPING_WINDOW_MS);
  });

  it('prorroga mesmo no último milissegundo', () => {
    const result = applyAntiSniping(at(1), NOW);
    expect(result.extended).toBe(true);
    expect(result.endsAt.getTime()).toBe(NOW.getTime() + ANTI_SNIPING_WINDOW_MS);
  });

  it('nunca encurta o lote', () => {
    const endsAt = at(10 * 60_000);
    expect(applyAntiSniping(endsAt, NOW).endsAt.getTime()).toBeGreaterThanOrEqual(endsAt.getTime());
  });

  it('lances sucessivos na janela continuam estendendo o fim', () => {
    let endsAt = at(60_000);
    let now = NOW;
    for (let i = 0; i < 3; i++) {
      const result = applyAntiSniping(endsAt, now);
      expect(result.extended).toBe(true);
      expect(result.endsAt.getTime()).toBe(now.getTime() + ANTI_SNIPING_WINDOW_MS);
      endsAt = result.endsAt;
      now = new Date(now.getTime() + 90_000); // próximo lance 1m30s depois, ainda na janela
    }
  });
});

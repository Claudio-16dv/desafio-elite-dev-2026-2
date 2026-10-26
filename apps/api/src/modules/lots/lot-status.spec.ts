import { deriveLotStatus } from './lot-status';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('deriveLotStatus', () => {
  const window = { startsAt: at(-10), endsAt: at(10), canceledAt: null };

  it('SCHEDULED antes do início', () => {
    expect(deriveLotStatus({ ...window, startsAt: at(5) }, NOW)).toBe('SCHEDULED');
  });

  it('LIVE no instante de início e durante o lote', () => {
    expect(deriveLotStatus({ ...window, startsAt: NOW }, NOW)).toBe('LIVE');
    expect(deriveLotStatus(window, NOW)).toBe('LIVE');
  });

  it('CLOSED no instante do fim e depois', () => {
    expect(deriveLotStatus({ ...window, endsAt: NOW }, NOW)).toBe('CLOSED');
    expect(deriveLotStatus({ ...window, endsAt: at(-1) }, NOW)).toBe('CLOSED');
  });

  it('CANCELED vence qualquer outro estado', () => {
    expect(deriveLotStatus({ ...window, canceledAt: at(-1) }, NOW)).toBe('CANCELED');
    expect(deriveLotStatus({ startsAt: at(5), endsAt: at(10), canceledAt: at(-1) }, NOW)).toBe('CANCELED');
  });
});

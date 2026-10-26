/** Janela de anti-sniping: lances nos últimos 2 minutos prorrogam o lote. */
export const ANTI_SNIPING_WINDOW_MS = 2 * 60 * 1000;

export interface AntiSnipingResult {
  endsAt: Date;
  extended: boolean;
}

/**
 * Regra de prorrogação: se um lance é aceito quando faltam 2 minutos ou menos,
 * o fim do lote passa a ser "agora + 2 minutos". Nunca encurta o lote.
 */
export function applyAntiSniping(endsAt: Date, now: Date): AntiSnipingResult {
  const remainingMs = endsAt.getTime() - now.getTime();
  if (remainingMs > ANTI_SNIPING_WINDOW_MS) {
    return { endsAt, extended: false };
  }
  const extendedEnd = new Date(now.getTime() + ANTI_SNIPING_WINDOW_MS);
  return extendedEnd > endsAt ? { endsAt: extendedEnd, extended: true } : { endsAt, extended: false };
}

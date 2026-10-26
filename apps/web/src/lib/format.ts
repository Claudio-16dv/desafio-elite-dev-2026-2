const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dateTimeLong = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
const timeOnly = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\u00a0/g, ' ');
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDateTimeLong(iso: string): string {
  return dateTimeLong.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}

/** Primeiros e últimos caracteres de um hash: "a1b2c3d4…9f8e7d6c". */
export function shortHash(hash: string, size = 8): string {
  return hash.length <= size * 2 + 1 ? hash : `${hash.slice(0, size)}…${hash.slice(-size)}`;
}

/** Converte reais digitados ("1.234,56" ou "1234.56") em centavos; null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  let integerPart = cleaned;
  let fractionPart = '';
  // Só trata como decimal se houver 1 ou 2 dígitos depois do último separador.
  if (decimalIndex !== -1 && cleaned.length - decimalIndex - 1 <= 2) {
    integerPart = cleaned.slice(0, decimalIndex);
    fractionPart = cleaned.slice(decimalIndex + 1);
  }
  const digits = integerPart.replace(/[.,]/g, '');
  const value = Number(`${digits || '0'}.${(fractionPart + '00').slice(0, 2)}`);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Duração restante em texto: "1d 02:03:04", "02:03:04" ou "03:04". */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Valor de <input type="datetime-local"> (horário local) para uma data. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como moeda brasileira (ex.: 123456 -> "R$ 1.234,56"). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\u00a0/g, ' ');
}

/** Limite de qualquer valor monetário individual (R$ 1.000.000,00), com folga para o tipo INT do banco. */
export const MAX_MONEY_CENTS = 100_000_000;

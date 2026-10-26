'use client';

import { Input } from '@/components/ui/input';
import { formatBRL } from '@/lib/format';

interface MoneyInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  /** Valor em centavos. */
  valueCents: number;
  onChangeCents: (cents: number) => void;
  maxCents?: number;
}

/**
 * Campo de dinheiro estilo "caixa eletrônico": o usuário digita só números e os dois últimos
 * viram centavos (digitar 1 2 3 4 5 => R$ 123,45). Evita erros de vírgula/ponto.
 */
export function MoneyInput({ valueCents, onChangeCents, maxCents = 100_000_000, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatBRL(valueCents)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '');
        const cents = digits ? Math.min(Number(digits), maxCents) : 0;
        onChangeCents(cents);
      }}
      onFocus={(event) => event.target.select()}
      className={`tabular-nums ${props.className ?? ''}`}
    />
  );
}

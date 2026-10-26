import { IsInt, Max, Min } from 'class-validator';
import { MAX_MONEY_CENTS } from '../../../common/money';

export class DepositDto {
  /** Valor do depósito simulado, em centavos (mínimo R$ 1,00). */
  @IsInt({ message: 'Informe o valor do depósito em centavos (número inteiro).' })
  @Min(100, { message: 'O depósito mínimo é R$ 1,00.' })
  @Max(MAX_MONEY_CENTS, { message: 'O depósito máximo por operação é R$ 1.000.000,00.' })
  amountCents!: number;
}

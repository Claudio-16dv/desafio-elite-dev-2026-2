import { IsInt, Max, Min } from 'class-validator';
import { MAX_MONEY_CENTS } from '../../../common/money';

export class PlaceBidDto {
  /** Valor do lance em centavos. */
  @IsInt({ message: 'Informe o valor do lance em centavos (número inteiro).' })
  @Min(1, { message: 'O valor do lance deve ser maior que zero.' })
  @Max(MAX_MONEY_CENTS, { message: 'O valor máximo de um lance é R$ 1.000.000,00.' })
  amountCents!: number;
}

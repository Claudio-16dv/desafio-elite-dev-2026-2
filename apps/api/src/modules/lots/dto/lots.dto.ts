import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_MONEY_CENTS } from '../../../common/money';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class CreateLotDto {
  /** Id do item na API externa. O servidor busca os dados; o cliente nunca os envia. */
  @IsString({ message: 'Escolha um item do acervo.' })
  @Matches(/^\d{1,12}$/, { message: 'Identificador de item inválido.' })
  externalId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'O título deve ter pelo menos 3 caracteres.' })
  @MaxLength(140, { message: 'O título deve ter no máximo 140 caracteres.' })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(600, { message: 'A observação deve ter no máximo 600 caracteres.' })
  description?: string;

  @IsInt({ message: 'Informe o lance inicial em centavos (número inteiro).' })
  @Min(100, { message: 'O lance inicial mínimo é R$ 1,00.' })
  @Max(MAX_MONEY_CENTS, { message: 'O lance inicial máximo é R$ 1.000.000,00.' })
  startingBidCents!: number;

  @IsInt({ message: 'Informe o incremento mínimo em centavos (número inteiro).' })
  @Min(100, { message: 'O incremento mínimo é R$ 1,00.' })
  @Max(MAX_MONEY_CENTS, { message: 'O incremento máximo é R$ 1.000.000,00.' })
  minIncrementCents!: number;

  @IsISO8601({ strict: true }, { message: 'Informe a data/hora de início válida.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Informe a data/hora de fim válida.' })
  endsAt!: string;
}

export const LOT_LIST_STATUSES = ['live', 'scheduled', 'closed'] as const;
export const LOT_LIST_SORTS = ['ending_soon', 'newest', 'most_bids'] as const;

export class ListLotsDto {
  @IsOptional()
  @IsIn(LOT_LIST_STATUSES, { message: 'Status inválido.' })
  status: (typeof LOT_LIST_STATUSES)[number] = 'live';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80, { message: 'A busca deve ter no máximo 80 caracteres.' })
  q?: string;

  @IsOptional()
  @IsIn(LOT_LIST_SORTS, { message: 'Ordenação inválida.' })
  sort?: (typeof LOT_LIST_SORTS)[number];

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize: number = 12;
}

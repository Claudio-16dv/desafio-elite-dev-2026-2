import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CATALOG_TYPES } from '../catalog.types';

export class SearchCatalogDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80, { message: 'A busca deve ter no máximo 80 caracteres.' })
  q?: string;

  @IsOptional()
  @IsIn(CATALOG_TYPES, { message: 'Tipo de obra inválido.' })
  type?: (typeof CATALOG_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(500)
  page: number = 1;
}

import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Informe seu nome.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  name!: string;

  @Transform(trimLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(160, { message: 'O e-mail deve ter no máximo 160 caracteres.' })
  email!: string;

  @IsString({ message: 'Informe uma senha.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password!: string;

  @IsIn(['AUCTIONEER', 'BIDDER'], { message: 'Escolha o perfil: leiloeiro ou licitante.' })
  role!: 'AUCTIONEER' | 'BIDDER';
}

export class LoginDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString({ message: 'Informe sua senha.' })
  @MinLength(1, { message: 'Informe sua senha.' })
  @MaxLength(72)
  password!: string;
}

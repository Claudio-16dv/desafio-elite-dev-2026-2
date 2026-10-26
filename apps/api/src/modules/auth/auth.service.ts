import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from '../../common/auth/authenticated-user';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;
// Hash descartável: gasta o mesmo tempo ao comparar quando o e-mail não existe,
// para não revelar quais e-mails estão cadastrados pelo tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente', BCRYPT_ROUNDS);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      // Usuário e carteira nascem juntos (toda conta tem carteira).
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          wallet: { create: {} },
        },
      });
      return this.buildSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException(
          'EMAIL_ALREADY_REGISTERED',
          'Já existe uma conta com este e-mail.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      throw new DomainException(
        'INVALID_CREDENTIALS',
        'E-mail ou senha incorretos.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.buildSession(user);
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Sua sessão expirou. Entre novamente.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.toSessionUser(user);
  }

  private async buildSession(user: User): Promise<AuthSession> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.toSessionUser(user),
    };
  }

  private toSessionUser(user: User): SessionUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

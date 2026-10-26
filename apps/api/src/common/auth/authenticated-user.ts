import { Role } from '@prisma/client';

/** Usuário extraído do token JWT e anexado à requisição. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  role: Role;
}

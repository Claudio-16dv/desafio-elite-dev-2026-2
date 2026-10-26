import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papéis informados (use junto com JwtAuthGuard e RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

type RequestWithUser = Request & { user?: AuthenticatedUser };

/** Injeta o usuário autenticado (obrigatório). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest<RequestWithUser>().user as AuthenticatedUser;
  },
);

/** Injeta o usuário autenticado se houver token válido; caso contrário, undefined. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return ctx.switchToHttp().getRequest<RequestWithUser>().user;
  },
);

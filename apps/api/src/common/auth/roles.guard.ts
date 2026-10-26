import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { DomainException } from '../errors/domain.exception';
import { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './decorators';

/** Aplica @Roles(...). Deve vir DEPOIS do JwtAuthGuard em @UseGuards. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user || !required.includes(request.user.role)) {
      throw new DomainException(
        'FORBIDDEN',
        'Seu perfil não tem permissão para esta ação.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}

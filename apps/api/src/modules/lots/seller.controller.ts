import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { LotsService } from './lots.service';

/** Painel do leiloeiro: seus lotes, resultados e total recebido. */
@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AUCTIONEER)
export class SellerController {
  constructor(private readonly lots: LotsService) {}

  @Get('lots')
  myLots(@CurrentUser() user: AuthenticatedUser) {
    return this.lots.listForSeller(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.lots.sellerSummary(user.id);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { DepositDto } from './dto/deposit.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** Saldo total, comprometido, disponível e últimas movimentações. */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.getWallet(user.id);
  }

  /** Depósito simulado. Apenas licitantes depositam. */
  @Post('deposit')
  @Roles(Role.BIDDER)
  @HttpCode(HttpStatus.OK)
  deposit(@CurrentUser() user: AuthenticatedUser, @Body() dto: DepositDto) {
    return this.wallet.deposit(user.id, dto.amountCents);
  }
}

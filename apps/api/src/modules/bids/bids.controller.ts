import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ParticipationsService } from './participations.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BIDDER)
export class BidsController {
  constructor(
    private readonly bids: BidsService,
    private readonly participations: ParticipationsService,
  ) {}

  /** Dá um lance. Somente licitantes (o leiloeiro não pode dar lances). */
  @Post('lots/:id/bids')
  @HttpCode(HttpStatus.CREATED)
  placeBid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) lotId: string,
    @Body() dto: PlaceBidDto,
  ) {
    return this.bids.placeBid(user.id, lotId, dto.amountCents);
  }

  /** Meus arremates: lotes com lance do usuário e os que ele venceu (com comprovante). */
  @Get('bidder/participations')
  myParticipations(@CurrentUser() user: AuthenticatedUser) {
    return this.participations.list(user.id);
  }
}

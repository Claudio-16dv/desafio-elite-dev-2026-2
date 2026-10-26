import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser, OptionalUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateLotDto, ListLotsDto } from './dto/lots.dto';
import { LotsService } from './lots.service';

@Controller('lots')
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  /** Vitrine pública (ao vivo, agendados, encerrados) com busca e ordenação. */
  @Get()
  list(@Query() query: ListLotsDto) {
    return this.lots.list(query);
  }

  /** Sala do lote. Pública; com token, devolve também a situação do usuário (`me`). */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('id', ParseUUIDPipe) id: string, @OptionalUser() viewer?: AuthenticatedUser) {
    return this.lots.getDetail(id, viewer);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTIONEER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLotDto) {
    return this.lots.create(user.id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTIONEER)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lots.cancel(user.id, id);
  }
}

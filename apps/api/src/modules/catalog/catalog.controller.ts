import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CatalogService } from './catalog.service';
import { SearchCatalogDto } from './dto/search-catalog.dto';

const PAGE_SIZE = 12;

/** Busca no acervo externo. Somente leiloeiros montam lotes. */
@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AUCTIONEER)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('items')
  search(@Query() query: SearchCatalogDto) {
    return this.catalog.search({
      q: query.q || undefined,
      type: query.type,
      page: query.page,
      pageSize: PAGE_SIZE,
    });
  }
}

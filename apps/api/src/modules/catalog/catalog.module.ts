import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ClevelandClient } from './cleveland.client';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, ClevelandClient],
  exports: [CatalogService],
})
export class CatalogModule {}

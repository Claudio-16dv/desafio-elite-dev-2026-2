import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { IntegrityModule } from '../integrity/integrity.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletModule } from '../wallet/wallet.module';
import { LotViewMapper } from './lot-view.mapper';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';
import { SellerController } from './seller.controller';

@Module({
  imports: [CatalogModule, IntegrityModule, RealtimeModule, WalletModule],
  controllers: [LotsController, SellerController],
  providers: [LotsService, LotViewMapper],
  exports: [LotViewMapper],
})
export class LotsModule {}

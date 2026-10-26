import { Module } from '@nestjs/common';
import { BidsModule } from '../../modules/bids/bids.module';
import { IntegrityModule } from '../../modules/integrity/integrity.module';
import { SettlementModule } from '../../modules/settlement/settlement.module';
import { SeedService } from './seed.service';

@Module({
  imports: [BidsModule, IntegrityModule, SettlementModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

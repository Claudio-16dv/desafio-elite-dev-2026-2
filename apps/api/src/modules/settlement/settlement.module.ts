import { Module } from '@nestjs/common';
import { IntegrityModule } from '../integrity/integrity.module';
import { LotsModule } from '../lots/lots.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletModule } from '../wallet/wallet.module';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';

@Module({
  imports: [IntegrityModule, LotsModule, RealtimeModule, WalletModule],
  providers: [SettlementService, SettlementScheduler],
  exports: [SettlementService],
})
export class SettlementModule {}

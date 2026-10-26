import { Module } from '@nestjs/common';
import { IntegrityModule } from '../integrity/integrity.module';
import { LotsModule } from '../lots/lots.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletModule } from '../wallet/wallet.module';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { ParticipationsService } from './participations.service';

@Module({
  imports: [IntegrityModule, LotsModule, RealtimeModule, WalletModule],
  controllers: [BidsController],
  providers: [BidsService, ParticipationsService],
  exports: [BidsService],
})
export class BidsModule {}

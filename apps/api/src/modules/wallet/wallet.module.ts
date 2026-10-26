import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletController } from './wallet.controller';
import { WalletLedger } from './wallet-ledger';
import { WalletService } from './wallet.service';

@Module({
  imports: [RealtimeModule],
  controllers: [WalletController],
  providers: [WalletService, WalletLedger],
  exports: [WalletLedger],
})
export class WalletModule {}

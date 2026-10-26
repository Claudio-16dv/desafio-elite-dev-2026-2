import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IntegrityModule } from '../integrity/integrity.module';
import { LotsModule } from '../lots/lots.module';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [AuditModule, IntegrityModule, LotsModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}

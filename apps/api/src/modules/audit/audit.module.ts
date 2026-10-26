import { Module } from '@nestjs/common';
import { IntegrityModule } from '../integrity/integrity.module';
import { LotsModule } from '../lots/lots.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [IntegrityModule, LotsModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

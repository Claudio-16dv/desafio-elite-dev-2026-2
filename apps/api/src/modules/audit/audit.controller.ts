import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Endpoint PÚBLICO (sem login): qualquer pessoa pode auditar o histórico de um lote. */
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('lots/:id')
  auditLot(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.auditLot(id);
  }
}

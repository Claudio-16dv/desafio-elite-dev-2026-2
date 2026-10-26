import { Controller, Get, Param } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { ReceiptsService } from './receipts.service';

const CODE_RE = /^[A-Za-z0-9_-]{8,32}$/;

/** Endpoint PÚBLICO: o comprovante é compartilhável por link. */
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get(':code')
  get(@Param('code') code: string) {
    if (!CODE_RE.test(code)) {
      throw new DomainException('RECEIPT_NOT_FOUND', 'Comprovante não encontrado. Confira o link.', 404);
    }
    return this.receipts.getByCode(code);
  }
}

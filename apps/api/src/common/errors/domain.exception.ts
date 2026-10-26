import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'LOT_NOT_FOUND'
  | 'RECEIPT_NOT_FOUND'
  | 'INVALID_LOT_SCHEDULE'
  | 'LOT_ALREADY_CANCELED'
  | 'LOT_ALREADY_ENDED'
  | 'CATALOG_UNAVAILABLE'
  | 'CATALOG_ITEM_NOT_FOUND'
  | 'DEPOSIT_LIMIT_EXCEEDED'
  // Motivos de recusa de lance (veja modules/bids/bid-rules.ts)
  | 'LOT_CANCELED'
  | 'LOT_NOT_STARTED'
  | 'LOT_ENDED'
  | 'ALREADY_LEADING'
  | 'BID_BELOW_MINIMUM'
  | 'INSUFFICIENT_BALANCE';

/**
 * Erro de negócio com formato estável para o front-end:
 * `{ statusCode, code, message, details? }`.
 * `code` é para a máquina; `message` já vem em português para o usuário.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ statusCode: status, code, message, details }, status);
  }
}

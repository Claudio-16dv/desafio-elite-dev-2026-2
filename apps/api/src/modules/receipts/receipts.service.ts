import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, IntegrityReport } from '../audit/audit.service';
import { IntegrityIssue, safeEqualHex } from '../integrity/hash-chain';
import { IntegrityService } from '../integrity/integrity.service';
import { LotViewMapper } from '../lots/lot-view.mapper';
import { LotSummaryView } from '../lots/lot-view.types';

export interface ReceiptView {
  code: string;
  lotId: string;
  issuedAt: string;
  finalPriceCents: number;
  bidCount: number;
  chainHeadHash: string;
  winnerPseudonym: string;
  sellerPseudonym: string;
  lot: LotSummaryView;
  /** Conferência do comprovante + do histórico de lances do lote. */
  integrity: IntegrityReport;
  serverNow: string;
}

/**
 * Comprovante de arremate. É público por link (o código é imprevisível) e mostra
 * somente pseudônimos. Lê apenas do banco: continua funcionando com a API externa fora do ar.
 */
@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly integrity: IntegrityService,
    private readonly audit: AuditService,
    private readonly mapper: LotViewMapper,
  ) {}

  async getByCode(code: string): Promise<ReceiptView> {
    const now = this.clock.now();
    const receipt = await this.prisma.receipt.findUnique({ where: { code } });
    if (!receipt) {
      throw new DomainException(
        'RECEIPT_NOT_FOUND',
        'Comprovante não encontrado. Confira o link.',
        HttpStatus.NOT_FOUND,
      );
    }

    const { lot, verification } = await this.audit.loadAndVerify(receipt.lotId);
    const issues: IntegrityIssue[] = [...verification.issues];

    const expectedSeal = this.integrity.receiptSeal({
      code: receipt.code,
      lotId: receipt.lotId,
      winnerId: receipt.winnerId,
      sellerId: receipt.sellerId,
      finalPriceCents: receipt.finalPriceCents,
      bidCount: receipt.bidCount,
      chainHeadHash: receipt.chainHeadHash,
      issuedAt: receipt.issuedAt,
    });
    if (!safeEqualHex(receipt.seal, expectedSeal)) {
      issues.push({
        code: 'RECEIPT_SEAL_MISMATCH',
        message: 'O selo do comprovante não confere: os dados do comprovante foram modificados.',
      });
    }

    const consistent =
      lot.winnerId === receipt.winnerId &&
      lot.sellerId === receipt.sellerId &&
      lot.finalPriceCents === receipt.finalPriceCents &&
      lot.bidCount === receipt.bidCount &&
      lot.chainHeadHash === receipt.chainHeadHash;
    if (!consistent) {
      issues.push({
        code: 'RECEIPT_LOT_MISMATCH',
        message: 'Os dados do comprovante divergem do lote e do histórico de lances registrados.',
      });
    }

    const valid = issues.length === 0;
    return {
      code: receipt.code,
      lotId: receipt.lotId,
      issuedAt: receipt.issuedAt.toISOString(),
      finalPriceCents: receipt.finalPriceCents,
      bidCount: receipt.bidCount,
      chainHeadHash: receipt.chainHeadHash,
      winnerPseudonym: this.integrity.pseudonym('bidder', receipt.lotId, receipt.winnerId),
      sellerPseudonym: this.integrity.pseudonym('seller', receipt.lotId, receipt.sellerId),
      lot: this.mapper.toSummary(lot, now),
      integrity: {
        ...this.audit.toReport({ ...verification, valid, issues }, now),
      },
      serverNow: now.toISOString(),
    };
  }
}

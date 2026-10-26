import { HttpStatus, Injectable } from '@nestjs/common';
import { Bid, Lot } from '@prisma/client';
import { Clock } from '../../common/clock';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ChainVerification, IntegrityIssue } from '../integrity/hash-chain';
import { IntegrityService } from '../integrity/integrity.service';
import { LotViewMapper } from '../lots/lot-view.mapper';
import { LotSummaryView } from '../lots/lot-view.types';
import { PublicBid } from '../realtime/realtime.events';

export interface IntegrityReport {
  /** INTACT = nada foi alterado; TAMPERED = foi detectada adulteração. */
  status: 'INTACT' | 'TAMPERED';
  valid: boolean;
  checkedBids: number;
  headHash: string | null;
  issues: IntegrityIssue[];
  checkedAt: string;
  /** Explicação curta da técnica, exibida na página pública de auditoria. */
  method: string;
}

export interface LotAuditView {
  lot: LotSummaryView;
  bids: PublicBid[];
  integrity: IntegrityReport;
  serverNow: string;
}

export const INTEGRITY_METHOD =
  'Cada lance guarda um hash HMAC-SHA256 calculado sobre seus dados e sobre o hash do lance anterior (uma cadeia, como num blockchain simplificado). ' +
  'O segredo do HMAC fica fora do banco. Alterar, remover ou inserir qualquer lance depois do fato quebra a cadeia e é detectado aqui. ' +
  'O lote também guarda um selo HMAC do resumo e das regras (valores, datas, leiloeiro), e o resultado da liquidação é conferido contra a cadeia.';

/** Auditoria pública: reconfere a integridade do histórico de lances de um lote. */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly integrity: IntegrityService,
    private readonly mapper: LotViewMapper,
  ) {}

  async auditLot(lotId: string): Promise<LotAuditView> {
    const now = this.clock.now();
    const { lot, bids, verification } = await this.loadAndVerify(lotId);
    return {
      lot: this.mapper.toSummary(lot, now),
      bids: bids.map((bid) => this.mapper.toPublicBid(bid)),
      integrity: this.toReport(verification, now),
      serverNow: now.toISOString(),
    };
  }

  /** Carrega lote + lances direto do banco e reconfere a cadeia. Reutilizado pelo comprovante. */
  async loadAndVerify(
    lotId: string,
  ): Promise<{ lot: Lot; bids: Bid[]; verification: ChainVerification }> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { bids: { orderBy: { sequence: 'asc' } } },
    });
    if (!lot) {
      throw new DomainException('LOT_NOT_FOUND', 'Lote não encontrado.', HttpStatus.NOT_FOUND);
    }
    const { bids, ...lotRow } = lot;
    return { lot: lotRow, bids, verification: this.integrity.verifyChain(lotRow, bids) };
  }

  toReport(verification: ChainVerification, now: Date): IntegrityReport {
    return {
      status: verification.valid ? 'INTACT' : 'TAMPERED',
      valid: verification.valid,
      checkedBids: verification.checkedBids,
      headHash: verification.headHash,
      issues: verification.issues,
      checkedAt: now.toISOString(),
      method: INTEGRITY_METHOD,
    };
  }
}

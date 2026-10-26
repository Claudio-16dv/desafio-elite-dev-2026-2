import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';

/**
 * Relógio do servidor que encerra os lotes: roda a cada segundo, SEM depender de
 * ninguém estar com a página aberta. A atualização para quem está assistindo
 * chega por WebSocket (evento lot:closed).
 */
@Injectable()
export class SettlementScheduler {
  private readonly logger = new Logger(SettlementScheduler.name);
  private running = false;
  /** Lotes com histórico adulterado: registrados uma única vez no log e ignorados. */
  private readonly quarantined = new Set<string>();

  constructor(private readonly settlement: SettlementService) {}

  @Interval(1000)
  async tick(): Promise<void> {
    if (this.running) return; // evita execuções sobrepostas se o banco estiver lento
    this.running = true;
    try {
      // Os lotes em quarentena ficam FORA da consulta: assim eles nunca ocupam a fila
      // e não impedem a liquidação dos lotes mais novos.
      const dueIds = await this.settlement.findDueLotIds(50, this.quarantined);
      for (const lotId of dueIds) {
        try {
          const outcome = await this.settlement.settleLot(lotId);
          if (outcome.kind === 'TAMPERED') {
            this.quarantined.add(lotId);
            this.logger.error(
              `Lote ${lotId} NÃO foi liquidado: histórico de lances adulterado. ${outcome.issues.join(' | ')}`,
            );
          }
        } catch (error) {
          this.logger.error(`Falha ao liquidar o lote ${lotId}`, error instanceof Error ? error.stack : String(error));
        }
      }
    } catch (error) {
      this.logger.error('Falha ao buscar lotes vencidos', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}

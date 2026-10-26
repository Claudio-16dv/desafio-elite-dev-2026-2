import { Injectable } from '@nestjs/common';

/**
 * Relógio injetável. Centralizar o "agora" permite testar regras que dependem
 * de tempo (início/fim do lote, anti-sniping) sem esperar de verdade.
 */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}

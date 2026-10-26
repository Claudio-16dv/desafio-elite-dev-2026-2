import { Global, Module } from '@nestjs/common';
import { Clock } from './clock';

/** Utilitários transversais (relógio) disponíveis para todos os módulos. */
@Global()
@Module({
  providers: [Clock],
  exports: [Clock],
})
export class CommonModule {}

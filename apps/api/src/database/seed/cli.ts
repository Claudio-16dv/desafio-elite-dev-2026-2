import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SeedService } from './seed.service';

/**
 * Uso:
 *   npm run seed            # cria contas e lotes de demonstração que faltarem
 *   npm run seed -- --reset # APAGA TODOS OS DADOS e recria a demonstração do zero
 */
async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    await app.get(SeedService).run({ reset });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

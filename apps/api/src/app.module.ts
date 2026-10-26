import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { SeedModule } from './database/seed/seed.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BidsModule } from './modules/bids/bids.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { LotsModule } from './modules/lots/lots.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    ScheduleModule.forRoot(),
    // Limite geral generoso (600 req/min por IP); login/registro têm limite próprio mais estrito.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    CommonModule,
    PrismaModule,
    AuthModule,
    WalletModule,
    CatalogModule,
    LotsModule,
    BidsModule,
    SettlementModule,
    AuditModule,
    ReceiptsModule,
    RealtimeModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

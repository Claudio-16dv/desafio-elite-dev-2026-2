import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  LotBidEvent,
  LotCanceledEvent,
  LotClosedEvent,
  OutbidEvent,
  ServerEvents,
  WalletUpdatedEvent,
} from './realtime.events';

export const lotRoom = (lotId: string) => `lot:${lotId}`;
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Porta de saída para o tempo real. Os módulos de domínio chamam estes métodos
 * DEPOIS de confirmar a transação no banco; nunca conhecem o Socket.IO diretamente.
 * Se o servidor ainda não subiu (ex.: testes/seed), os métodos são no-ops.
 */
@Injectable()
export class RealtimeService {
  private server?: Server;

  attach(server: Server): void {
    this.server = server;
  }

  lotBid(event: LotBidEvent): void {
    this.server?.to(lotRoom(event.lotId)).emit(ServerEvents.LotBid, event);
  }

  lotClosed(event: LotClosedEvent): void {
    this.server?.to(lotRoom(event.lotId)).emit(ServerEvents.LotClosed, event);
  }

  lotCanceled(event: LotCanceledEvent): void {
    this.server?.to(lotRoom(event.lotId)).emit(ServerEvents.LotCanceled, event);
  }

  walletUpdated(userId: string, event: WalletUpdatedEvent): void {
    this.server?.to(userRoom(userId)).emit(ServerEvents.WalletUpdated, event);
  }

  outbid(userId: string, event: OutbidEvent): void {
    this.server?.to(userRoom(userId)).emit(ServerEvents.Outbid, event);
  }
}

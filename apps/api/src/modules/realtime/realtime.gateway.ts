import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../common/auth/authenticated-user';
import { ClientEvents, REALTIME_NAMESPACE } from './realtime.events';
import { RealtimeService, lotRoom, userRoom } from './realtime.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gateway Socket.IO. Responsabilidade única: gerenciar conexões e salas.
 * Quem emite eventos de negócio é o RealtimeService.
 * A origem CORS é configurada no adaptador (veja realtime.adapter.ts).
 */
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  /** Conexão anônima é permitida (vitrine/auditoria); com token entra também na sala privada. */
  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== 'string' || token.length === 0) return;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      await client.join(userRoom(payload.sub));
      client.data.userId = payload.sub;
    } catch {
      this.logger.debug('Token inválido no handshake do socket; seguindo como anônimo.');
    }
  }

  @SubscribeMessage(ClientEvents.JoinLot)
  async joinLot(@ConnectedSocket() client: Socket, @MessageBody() lotId: unknown): Promise<void> {
    if (typeof lotId === 'string' && UUID_RE.test(lotId)) {
      await client.join(lotRoom(lotId));
    }
  }

  @SubscribeMessage(ClientEvents.LeaveLot)
  async leaveLot(@ConnectedSocket() client: Socket, @MessageBody() lotId: unknown): Promise<void> {
    if (typeof lotId === 'string' && UUID_RE.test(lotId)) {
      await client.leave(lotRoom(lotId));
    }
  }
}

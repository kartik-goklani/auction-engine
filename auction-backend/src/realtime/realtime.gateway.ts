import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  handleConnection(client: Socket): void {
    const userId = client.handshake.query['userId'] as string | undefined;
    if (userId) {
      // Join user-specific room for targeted notifications
      void client.join(`user:${userId}`);
    }
  }

  handleDisconnect(_client: Socket): void {
    // Socket.IO automatically removes the socket from all rooms on disconnect
  }

  @SubscribeMessage('join_auction')
  handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string; vendorId: string },
  ): void {
    void client.join(`auction:${payload.auctionId}`);
  }

  @SubscribeMessage('leave_auction')
  handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string },
  ): void {
    void client.leave(`auction:${payload.auctionId}`);
  }
}

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
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

  private readonly authClient: SupabaseClient;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly config: ConfigService,
  ) {
    this.authClient = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.['token'] as string | undefined;
    if (!token) return;

    const { data, error } = await this.authClient.auth.getUser(token);
    if (error || !data.user) {
      client.disconnect(true);
      return;
    }

    client.data.userId = data.user.id;
    client.data.role = data.user.user_metadata?.['role'] ?? null;
    await client.join(`user:${data.user.id}`);
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

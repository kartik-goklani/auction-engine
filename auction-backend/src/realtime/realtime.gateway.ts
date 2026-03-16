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
import { Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { VendorsService } from '../vendors/vendors.service';

@WebSocketGateway({
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** Maps socketId → auctionId so handleDisconnect can find the auction to update. */
  private readonly socketAuctions = new Map<string, string>();

  private readonly authClient: SupabaseClient;

  constructor(
    private readonly realtimeService: RealtimeService,
    @Inject(forwardRef(() => VendorsService))
    private readonly vendorsService: VendorsService,
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

  async handleDisconnect(client: Socket): Promise<void> {
    const auctionId = this.socketAuctions.get(client.id);
    if (auctionId) {
      this.socketAuctions.delete(client.id);
      const count = await this.realtimeService.getVendorParticipantCount(auctionId);
      this.realtimeService.emitParticipantsChanged(auctionId, count);
    }
  }

  @SubscribeMessage('join_auction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string; vendorId: string },
  ): Promise<void> {
    // Buyers own the auction and are allowed unconditionally.
    // Only vendors need invitation status verification.
    if (client.data.role !== 'buyer') {
      const isEligible = await this.vendorsService.verifyInvitationAccepted(
        payload.auctionId,
        payload.vendorId,
      );

      if (!isEligible) {
        client.emit('bid_rejected', { reason: 'VENDOR_NOT_ELIGIBLE' });
        return;
      }
    }

    await client.join(`auction:${payload.auctionId}`);
    this.socketAuctions.set(client.id, payload.auctionId);
    const count = await this.realtimeService.getVendorParticipantCount(
      payload.auctionId,
    );
    this.realtimeService.emitParticipantsChanged(payload.auctionId, count);
  }

  @SubscribeMessage('leave_auction')
  async handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string },
  ): Promise<void> {
    await client.leave(`auction:${payload.auctionId}`);
    const auctionId = this.socketAuctions.get(client.id);
    if (auctionId) {
      this.socketAuctions.delete(client.id);
      const count = await this.realtimeService.getVendorParticipantCount(auctionId);
      this.realtimeService.emitParticipantsChanged(auctionId, count);
    }
  }
}

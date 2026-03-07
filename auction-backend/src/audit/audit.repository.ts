import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import type { ActorType } from '../common/types';

export interface CreateAuditLogEntry {
  auctionId?: string;
  actorId: string;
  actorType: ActorType;
  action: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(entry: CreateAuditLogEntry): Promise<void> {
    await this.db.getClient().from('audit_logs').insert({
      auction_id: entry.auctionId ?? null,
      actor_id: entry.actorId,
      actor_type: entry.actorType,
      action: entry.action,
      metadata: entry.metadata ?? null,
    });
    // NOTE: Errors here are intentionally swallowed — audit logging must never
    // propagate failures to the caller. The bid/auction pipeline should not fail
    // because of a logging write failure.
  }
}

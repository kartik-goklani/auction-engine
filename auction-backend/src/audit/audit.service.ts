import { Injectable } from '@nestjs/common';
import { AuditRepository, type CreateAuditLogEntry } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  /**
   * Fire-and-forget audit log write.
   * Returns void — callers MUST NOT await this method.
   * Failures are silently absorbed so they never propagate to the caller.
   */
  log(entry: CreateAuditLogEntry): void {
    // intentional fire-and-forget: audit logs must never block or fail the calling operation
    void this.auditRepository.insert(entry).catch(() => undefined);
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  VendorsRepository,
  type VendorRow,
  type VendorWithPerformance,
  type InvitationRow,
} from './vendors.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { NotificationType, InvitationStatus, ActorType } from '../common/types';
import type { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Injectable()
export class VendorsService {
  constructor(
    private readonly vendorsRepository: VendorsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  findAllApproved(): Promise<VendorRow[]> {
    return this.vendorsRepository.findAllApproved();
  }

  findById(id: string): Promise<VendorWithPerformance> {
    return this.vendorsRepository.findById(id);
  }

  async getOwnProfile(userId: string): Promise<VendorRow> {
    const vendor = await this.vendorsRepository.findByUserId(userId);
    if (!vendor) throw new NotFoundException('Vendor profile not found');
    return vendor;
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateVendorProfileDto,
  ): Promise<VendorRow> {
    const vendor = await this.getOwnProfile(userId);

    const fields: { company_name?: string; contact_name?: string; category_tags?: string[] } = {};
    if (dto.companyName !== undefined) fields.company_name = dto.companyName;
    if (dto.contactName !== undefined) fields.contact_name = dto.contactName;
    if (dto.categoryTags !== undefined) fields.category_tags = dto.categoryTags;

    return this.vendorsRepository.updateProfile(vendor.id, fields);
  }

  // ── Invitations (Buyer) ───────────────────────────────────────────────────

  async inviteVendors(
    auctionId: string,
    vendorIds: string[],
    buyerId: string,
  ): Promise<void> {
    const auctionStatus = await this.vendorsRepository.findAuctionStatus(auctionId);
    if (!auctionStatus || auctionStatus === 'DRAFT' || auctionStatus === 'CANCELLED') {
      throw new UnprocessableEntityException(
        'Vendors can only be invited to PUBLISHED or OPEN auctions',
      );
    }

    await this.vendorsRepository.createInvitations(auctionId, vendorIds);

    // Notify each invited vendor — fire-and-forget per vendor
    for (const vendorId of vendorIds) {
      const vendor = await this.vendorsRepository.findById(vendorId).catch(() => null);
      if (vendor?.user_id) {
        this.notificationsService.send(
          vendor.user_id,
          NotificationType.INVITATION_RECEIVED,
          'You have been invited to an auction',
          undefined,
          { auctionId },
        );
      }
    }

    this.auditService.log({
      auctionId,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'VENDORS_INVITED',
      metadata: { vendorIds },
    });
  }

  findInvitationsByAuction(auctionId: string): Promise<InvitationRow[]> {
    return this.vendorsRepository.findInvitationsByAuction(auctionId);
  }

  async revokeInvitation(
    auctionId: string,
    vendorId: string,
    buyerId: string,
  ): Promise<void> {
    await this.vendorsRepository.revokeInvitation(auctionId, vendorId);

    this.auditService.log({
      auctionId,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'INVITATION_REVOKED',
      metadata: { vendorId },
    });
  }

  // ── Invitations (Vendor) ──────────────────────────────────────────────────

  async findMyInvitations(userId: string): Promise<InvitationRow[]> {
    const vendor = await this.getOwnProfile(userId);
    return this.vendorsRepository.findInvitationsByVendor(vendor.id);
  }

  async respondToInvitation(
    invitationId: string,
    status: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED,
    userId: string,
  ): Promise<InvitationRow> {
    const invitation = await this.vendorsRepository.findInvitation(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');

    const vendor = await this.getOwnProfile(userId);
    if (invitation.vendor_id !== vendor.id) {
      throw new ForbiddenException('This invitation does not belong to you');
    }

    if (invitation.status !== InvitationStatus.INVITED) {
      throw new UnprocessableEntityException('Invitation has already been responded to');
    }

    const updated = await this.vendorsRepository.updateInvitationStatus(
      invitationId,
      status,
    );

    this.auditService.log({
      auctionId: invitation.auction_id,
      actorId: vendor.id,
      actorType: ActorType.VENDOR,
      action: status === InvitationStatus.ACCEPTED ? 'INVITATION_ACCEPTED' : 'INVITATION_DECLINED',
    });

    return updated;
  }

  /** Used by BidsService to validate vendor eligibility before accepting a bid. */
  verifyInvitationAccepted(auctionId: string, vendorId: string): Promise<boolean> {
    return this.vendorsRepository.verifyInvitationAccepted(auctionId, vendorId);
  }

  countAcceptedInvitations(auctionId: string): Promise<number> {
    return this.vendorsRepository.countAcceptedInvitations(auctionId);
  }

  /** Used by AgentsService and BidsService to get the vendor DB id from a user id. */
  async getVendorIdByUserId(userId: string): Promise<string> {
    const vendor = await this.getOwnProfile(userId);
    return vendor.id;
  }

  async getUserIdByVendorId(vendorId: string): Promise<string | null> {
    return this.vendorsRepository.findUserIdByVendorId(vendorId);
  }
}

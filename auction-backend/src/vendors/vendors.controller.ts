import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types';
import { InviteVendorsDto } from './dto/invite-vendors.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Controller()
@UseGuards(JwtGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // ── Buyer: vendor directory ───────────────────────────────────────────────

  @Get('vendors')
  @Roles('buyer')
  findAll() {
    return this.vendorsService.findAllApproved();
  }

  @Get('vendors/:id')
  @Roles('buyer')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  // ── Vendor: own profile ───────────────────────────────────────────────────

  @Get('vendor/profile')
  @Roles('vendor')
  getProfile(@CurrentUser() user: CurrentUserType) {
    return this.vendorsService.getOwnProfile(user.id);
  }

  @Patch('vendor/profile')
  @Roles('vendor')
  updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.vendorsService.updateOwnProfile(user.id, dto);
  }

  // ── Buyer: invitation management ─────────────────────────────────────────

  @Post('auctions/:auctionId/invitations')
  @Roles('buyer')
  invite(
    @Param('auctionId') auctionId: string,
    @Body() dto: InviteVendorsDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.vendorsService.inviteVendors(auctionId, dto.vendorIds, user.id);
  }

  @Get('auctions/:auctionId/invitations')
  @Roles('buyer')
  listInvitations(@Param('auctionId') auctionId: string) {
    return this.vendorsService.findInvitationsByAuction(auctionId);
  }

  @Delete('auctions/:auctionId/invitations/:vendorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('buyer')
  revokeInvitation(
    @Param('auctionId') auctionId: string,
    @Param('vendorId') vendorId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.vendorsService.revokeInvitation(auctionId, vendorId, user.id);
  }

  // ── Vendor: invitation responses ─────────────────────────────────────────

  @Get('vendor/invitations')
  @Roles('vendor')
  myInvitations(@CurrentUser() user: CurrentUserType) {
    return this.vendorsService.findMyInvitations(user.id);
  }

  @Patch('vendor/invitations/:id/respond')
  @Roles('vendor')
  respond(
    @Param('id') id: string,
    @Body() dto: RespondInvitationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.vendorsService.respondToInvitation(id, dto.status, user.id);
  }
}

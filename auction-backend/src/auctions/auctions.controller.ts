import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuctionsService } from './auctions.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { CancelAuctionDto } from './dto/cancel-auction.dto';
import { ExtendAuctionDto } from './dto/extend-auction.dto';
import { AwardAuctionDto } from './dto/award-auction.dto';
import { PauseAuctionDto } from './dto/pause-auction.dto';
import { CreateLotDto } from './dto/create-lot.dto';

@Controller('auctions')
@UseGuards(JwtGuard, RolesGuard)
@Roles('buyer')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  create(
    @Body() dto: CreateAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.auctionsService.findByBuyer(user.id);
  }

  @Get(':id')
  @Roles('buyer', 'vendor')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    if (user.role === 'vendor') {
      return this.auctionsService.findByIdPublic(id);
    }
    return this.auctionsService.findById(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.update(id, user.id, dto);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.publish(id, user.id);
  }

  @Patch(':id/open')
  open(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.open(id, user.id);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.close(id, user.id);
  }

  @Patch(':id/award')
  award(
    @Param('id') id: string,
    @Body() dto: AwardAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.award(id, user.id, dto.winningVendorId);
  }

  @Patch(':id/extend')
  extend(
    @Param('id') id: string,
    @Body() dto: ExtendAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.extendByMinutes(id, user.id, dto.minutes);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.cancel(id, user.id, dto.reason);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.delete(id, user.id);
  }

  @Post(':id/clone')
  clone(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.clone(id, user.id);
  }

  @Post(':id/pause')
  pause(
    @Param('id') id: string,
    @Body() dto: PauseAuctionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.pause(id, user.id, dto.reason);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auctionsService.resume(id, user.id);
  }

  // ── Lots ──────────────────────────────────────────────────────────────────

  @Post(':id/lots')
  createLot(
    @Param('id') auctionId: string,
    @Body() dto: CreateLotDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.createLot(auctionId, user.id, dto);
  }

  @Get(':id/lots')
  findLots(@Param('id') auctionId: string) {
    return this.auctionsService.findLots(auctionId);
  }

  @Patch(':id/lots/:lotId')
  updateLot(
    @Param('id') auctionId: string,
    @Param('lotId') lotId: string,
    @Body() body: Partial<CreateLotDto>,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.auctionsService.updateLot(auctionId, lotId, user.id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.specifications !== undefined && { specifications: body.specifications }),
    });
  }

  // ── Audit trail ───────────────────────────────────────────────────────────

  @Get(':id/audit')
  getAuditLogs(@Param('id') auctionId: string) {
    return this.auctionsService.findAuditLogs(auctionId);
  }

  @Get(':id/audit/export')
  async exportAudit(
    @Param('id') auctionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.auctionsService.exportAuditCsv(auctionId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-${auctionId}.csv"`,
    });
    res.send(csv);
  }
}

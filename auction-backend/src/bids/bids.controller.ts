import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { BidsService } from './bids.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types';
import { CreateBidDto } from './dto/create-bid.dto';

@Controller('auctions/:auctionId/bids')
@UseGuards(JwtGuard, RolesGuard)
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles('vendor')
  submitBid(
    @Param('auctionId') auctionId: string,
    @Body() dto: CreateBidDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.bidsService.submitBid(auctionId, user.id, dto.amount);
  }

  @Get()
  @Roles('buyer')
  findAll(@Param('auctionId') auctionId: string) {
    return this.bidsService.findByAuction(auctionId);
  }

  @Get('mine')
  @Roles('vendor')
  findMine(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.bidsService.findMyBids(auctionId, user.id);
  }

  @Get('best')
  getBest(@Param('auctionId') auctionId: string) {
    return this.bidsService.getBestBid(auctionId);
  }
}

import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types';

@Controller()
@UseGuards(JwtGuard, RolesGuard)
@Roles('buyer')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('agents/price-intelligence/:auctionId')
  @HttpCode(HttpStatus.OK)
  triggerPriceIntelligence(
    @Param('auctionId') auctionId: string,
    @CurrentUser() _user: CurrentUserType,
  ): { triggered: true } {
    this.agentsService.runPriceIntelligence(auctionId);
    return { triggered: true };
  }

  @Get('auctions/:auctionId/agent-runs')
  getAgentRuns(@Param('auctionId') auctionId: string): Promise<unknown[]> {
    return this.agentsService.findRunsByAuction(auctionId);
  }

  @Get('auctions/:auctionId/alerts')
  getAlerts(@Param('auctionId') auctionId: string): Promise<unknown[]> {
    return this.agentsService.findAlertsByAuction(auctionId);
  }

  @Get('auctions/:auctionId/recommendation')
  getRecommendation(@Param('auctionId') auctionId: string): Promise<unknown> {
    return this.agentsService.findRecommendationByAuction(auctionId);
  }
}

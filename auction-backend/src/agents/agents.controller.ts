import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types';
import { AnalyzePriceIntelligenceDto } from './dto/analyze-price-intelligence.dto';
import type { PriceIntelligenceAnalysisResponse } from './agents.service';

@Controller()
@UseGuards(JwtGuard, RolesGuard)
@Roles('buyer')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('agents/price-intelligence/analyze')
  analyzePriceIntelligence(
    @Body() dto: AnalyzePriceIntelligenceDto,
    @CurrentUser() _user: CurrentUserType,
  ): Promise<PriceIntelligenceAnalysisResponse> {
    return this.agentsService.analyzePriceIntelligence(dto);
  }

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

  @Get('auctions/:auctionId/price-metadata')
  getPriceMetadata(@Param('auctionId') auctionId: string): Promise<unknown> {
    return this.agentsService.findPriceMetadataByAuction(auctionId);
  }

  @Get('auctions/:auctionId/alerts')
  getAlerts(@Param('auctionId') auctionId: string): Promise<unknown[]> {
    return this.agentsService.findAlertsByAuction(auctionId);
  }

  @Get('auctions/:auctionId/recommendation')
  getRecommendation(@Param('auctionId') auctionId: string): Promise<unknown> {
    return this.agentsService.findRecommendationByAuction(auctionId);
  }

  @Get('auctions/:auctionId/shortlist')
  getShortlist(@Param('auctionId') auctionId: string): Promise<unknown> {
    return this.agentsService.getShortlistResult(auctionId);
  }
}

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionsService } from './auctions.service';

@Injectable()
export class AuctionsScheduler {
  constructor(private readonly auctionsService: AuctionsService) {}

  /** Every minute: open PUBLISHED auctions whose start_time has passed. */
  @Cron(CronExpression.EVERY_MINUTE)
  async openDueAuctions(): Promise<void> {
    await this.auctionsService.autoOpenDueAuctions();
  }

  /** Every minute: close OPEN auctions whose end_time has passed. */
  @Cron(CronExpression.EVERY_MINUTE)
  async closeDueAuctions(): Promise<void> {
    await this.auctionsService.autoCloseDueAuctions();
  }
}

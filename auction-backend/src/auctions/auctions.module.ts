import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuctionsController } from './auctions.controller';
import { AuctionsService } from './auctions.service';
import { AuctionsRepository } from './auctions.repository';
import { AuctionsScheduler } from './auctions.scheduler';
import { BidsRepository } from '../bids/bids.repository';
import { AgentsModule } from '../agents/agents.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorsModule } from '../vendors/vendors.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AgentsModule,
    AuditModule,
    NotificationsModule,
    VendorsModule,
    AuthModule,
    RealtimeModule,
  ],
  controllers: [AuctionsController],
  // BidsRepository is registered here directly to avoid a circular module dependency
  // (BidsModule imports AuctionsModule). It depends only on the global DatabaseModule.
  providers: [AuctionsService, AuctionsRepository, AuctionsScheduler, BidsRepository],
  exports: [AuctionsService],
})
export class AuctionsModule {}

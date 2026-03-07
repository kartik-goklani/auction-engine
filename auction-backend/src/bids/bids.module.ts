import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { BidsRepository } from './bids.repository';
import { AuctionsModule } from '../auctions/auctions.module';
import { VendorsModule } from '../vendors/vendors.module';
import { AgentsModule } from '../agents/agents.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuctionsModule,
    VendorsModule,
    AgentsModule,
    AuditModule,
    NotificationsModule,
    RealtimeModule,
    AuthModule,
  ],
  controllers: [BidsController],
  providers: [BidsService, BidsRepository],
})
export class BidsModule {}

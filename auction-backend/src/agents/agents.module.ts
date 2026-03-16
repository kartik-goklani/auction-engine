import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AnomalyWindowService } from './anomaly-detection/anomaly-window.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RealtimeModule, AuthModule, NotificationsModule],
  controllers: [AgentsController],
  providers: [AgentsService, AnomalyWindowService],
  exports: [AgentsService, AnomalyWindowService],
})
export class AgentsModule {}

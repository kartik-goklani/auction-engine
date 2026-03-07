import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorsRepository } from './vendors.repository';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [NotificationsModule, AuditModule, AuthModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorsRepository],
  exports: [VendorsService],
})
export class VendorsModule {}

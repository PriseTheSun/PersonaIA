import { Module } from '@nestjs/common';
import { ClientAdminsController } from './client-admins.controller';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ClientMembershipsController } from './client-memberships.controller';
import { ClientMembershipsService } from './client-memberships.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TenantsController, ClientAdminsController, ClientMembershipsController],
  providers: [TenantsService, ClientMembershipsService],
  exports: [ClientMembershipsService],
})
export class TenantsModule {}

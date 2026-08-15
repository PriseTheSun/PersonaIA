import { Module } from '@nestjs/common';
import { ClientAdminsController } from './client-admins.controller';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ClientMembershipsController } from './client-memberships.controller';
import { ClientMembershipsService } from './client-memberships.service';

@Module({
  controllers: [TenantsController, ClientAdminsController, ClientMembershipsController],
  providers: [TenantsService, ClientMembershipsService],
})
export class TenantsModule {}

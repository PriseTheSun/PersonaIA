import { Module } from '@nestjs/common';
import { ClientAdminsController } from './client-admins.controller';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({ controllers: [TenantsController, ClientAdminsController], providers: [TenantsService] })
export class TenantsModule {}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientAdminQuerySchema, ClientAdminQuery, createClientAdminSchema, CreateClientAdminInput } from './tenants.schemas';
import { TenantsService } from './tenants.service';

@Roles('SUPER_ADMIN')
@Controller('client-admins')
export class ClientAdminsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(clientAdminQuerySchema)) query: ClientAdminQuery) { return this.tenants.listClientAdmins(query); }

  @Post()
  create(@Body(new ZodValidationPipe(createClientAdminSchema)) input: CreateClientAdminInput, @CurrentUser() actor: Principal) {
    return this.tenants.createClientAdmin(input, actor);
  }
}

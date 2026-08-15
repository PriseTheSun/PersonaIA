import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createTenantSchema, CreateTenantInput } from './tenants.schemas';
import { TenantsService } from './tenants.service';

@Roles('SUPER_ADMIN')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list() { return this.tenants.listTenants(); }

  @Post()
  create(@Body(new ZodValidationPipe(createTenantSchema)) input: CreateTenantInput, @CurrentUser() actor: Principal) {
    return this.tenants.createTenant(input, actor);
  }
}

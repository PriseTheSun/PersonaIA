import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createTenantSchema, CreateTenantInput, updateTenantSchema, UpdateTenantInput } from './tenants.schemas';
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

  @Get(':tenantId')
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) { return this.tenants.getTenant(tenantId); }

  @Patch(':tenantId')
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) input: UpdateTenantInput,
    @CurrentUser() actor: Principal,
  ) { return this.tenants.updateTenant(tenantId, input, actor); }

  @Delete(':tenantId')
  remove(@Param('tenantId', ParseUUIDPipe) tenantId: string, @CurrentUser() actor: Principal) {
    return this.tenants.removeTenant(tenantId, actor);
  }
}

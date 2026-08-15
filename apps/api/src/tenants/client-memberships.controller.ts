import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  addClientMembershipSchema, AddClientMembershipInput,
  updateClientMembershipSchema, UpdateClientMembershipInput,
} from './tenants.schemas';
import { ClientMembershipsService } from './client-memberships.service';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER')
@Controller('tenants/:tenantId/memberships')
export class ClientMembershipsController {
  constructor(private readonly memberships: ClientMembershipsService) {}

  @Get()
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @CurrentUser() actor: Principal) {
    return this.memberships.list(tenantId, actor);
  }

  @Post()
  add(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(addClientMembershipSchema)) input: AddClientMembershipInput,
    @CurrentUser() actor: Principal,
  ) { return this.memberships.add(tenantId, input, actor); }

  @Patch(':userId')
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateClientMembershipSchema)) input: UpdateClientMembershipInput,
    @CurrentUser() actor: Principal,
  ) { return this.memberships.update(tenantId, userId, input, actor); }

  @Delete(':userId')
  remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: Principal,
  ) { return this.memberships.remove(tenantId, userId, actor); }
}

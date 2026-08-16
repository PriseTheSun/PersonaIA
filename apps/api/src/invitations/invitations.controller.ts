import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CreateInvitationInput, createInvitationSchema } from './invitations.schemas';
import { InvitationsService } from './invitations.service';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER')
@Controller('tenants/:tenantId/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(createInvitationSchema)) input: CreateInvitationInput,
    @CurrentUser() actor: Principal,
  ) {
    return this.invitations.create(tenantId, input, actor);
  }
}

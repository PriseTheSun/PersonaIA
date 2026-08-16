import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationsQuery, notificationsQuerySchema } from './notifications.schemas';
import { NotificationsService } from './notifications.service';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(notificationsQuerySchema)) query: NotificationsQuery,
    @CurrentUser() actor: Principal,
  ) {
    return this.notifications.list(actor, query);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() actor: Principal) {
    return this.notifications.markAllRead(actor);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal) {
    return this.notifications.markRead(id, actor);
  }
}

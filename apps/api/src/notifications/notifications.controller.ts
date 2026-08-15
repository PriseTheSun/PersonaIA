import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { NotificationsService } from './notifications.service';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'PROJECT_USER')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: Principal) {
    return this.notifications.list(actor);
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

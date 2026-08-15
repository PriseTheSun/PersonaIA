import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersService } from './users.service';
import { UserAccessController } from './user-access.controller';

@Module({ imports: [NotificationsModule], controllers: [UserAccessController], providers: [UsersService] })
export class UsersModule {}

import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAccessController } from './user-access.controller';

@Module({ imports: [NotificationsModule], controllers: [UsersController, UserAccessController], providers: [UsersService] })
export class UsersModule {}

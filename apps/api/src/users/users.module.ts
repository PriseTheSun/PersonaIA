import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAccessController } from './user-access.controller';

@Module({ controllers: [UsersController, UserAccessController], providers: [UsersService] })
export class UsersModule {}

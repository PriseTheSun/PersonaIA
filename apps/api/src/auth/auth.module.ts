import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({ imports: [JwtModule.register({}), NotificationsModule, ProjectsModule], controllers: [AuthController], providers: [AuthService], exports: [JwtModule, AuthService] })
export class AuthModule {}

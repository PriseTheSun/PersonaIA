import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsController } from './projects.controller';
import { ProjectAccessCodeService } from './project-access-code.service';
import { ProjectsService } from './projects.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessCodeService],
  exports: [ProjectAccessCodeService],
})
export class ProjectsModule {}

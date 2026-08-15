import { Module } from '@nestjs/common';
import { WorkspaceMembersController, WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({ controllers: [WorkspacesController, WorkspaceMembersController], providers: [WorkspacesService] })
export class WorkspacesModule {}

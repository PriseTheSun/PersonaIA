import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  addMemberSchema, AddMemberInput, createProjectSchema, CreateProjectInput, moveMemberSchema, MoveMemberInput,
  updatePermissionSchema, UpdatePermissionInput, updateProjectSchema, UpdateProjectInput
} from './projects.schemas';
import { ProjectsService } from './projects.service';

@Roles('CLIENT_ADMIN')
@TenantScoped()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() actor: Principal) { return this.projects.list(actor); }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal) { return this.projects.get(id, actor); }

  @Post()
  create(@Body(new ZodValidationPipe(createProjectSchema)) input: CreateProjectInput, @CurrentUser() actor: Principal) {
    return this.projects.create(input, actor);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateProjectSchema)) input: UpdateProjectInput, @CurrentUser() actor: Principal) {
    return this.projects.update(id, input, actor);
  }

  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal) { return this.projects.listMembers(id, actor); }

  @Post(':id/members')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(addMemberSchema)) input: AddMemberInput, @CurrentUser() actor: Principal) {
    return this.projects.addMember(id, input, actor);
  }

  @Post(':id/members/move')
  moveMember(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(moveMemberSchema)) input: MoveMemberInput, @CurrentUser() actor: Principal) {
    return this.projects.moveMember(id, input, actor);
  }

  @Patch(':id/members/:userId/permissions')
  permission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updatePermissionSchema)) input: UpdatePermissionInput,
    @CurrentUser() actor: Principal
  ) { return this.projects.updatePermission(id, userId, input, actor); }

  @Delete(':id/members/:userId')
  removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() actor: Principal) {
    return this.projects.removeMember(id, userId, actor);
  }
}

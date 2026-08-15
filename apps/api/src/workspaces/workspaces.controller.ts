import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  addWorkspaceMemberSchema, AddWorkspaceMemberInput, createWorkspaceSchema, CreateWorkspaceInput,
  replacePermissionsSchema, ReplacePermissionsInput, updateWorkspaceMemberSchema, UpdateWorkspaceMemberInput,
  updateWorkspaceSchema, UpdateWorkspaceInput,
} from './workspaces.schemas';
import { WorkspacesService } from './workspaces.service';

const authenticated = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'] as const;

@Roles(...authenticated)
@Controller('tenants/:tenantId/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @CurrentUser() actor: Principal) {
    return this.workspaces.list(tenantId, actor);
  }

  @Post()
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) input: CreateWorkspaceInput,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.create(tenantId, input, actor); }

  @Get(':workspaceId')
  get(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.get(tenantId, workspaceId, actor); }

  @Patch(':workspaceId')
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) input: UpdateWorkspaceInput,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.update(tenantId, workspaceId, input, actor); }

  @Delete(':workspaceId')
  remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.remove(tenantId, workspaceId, actor); }
}

@Roles(...authenticated)
@Controller('workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() actor: Principal) {
    return this.workspaces.listMembers(workspaceId, actor);
  }

  @Post()
  add(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ZodValidationPipe(addWorkspaceMemberSchema)) input: AddWorkspaceMemberInput,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.addMember(workspaceId, input, actor); }

  @Patch(':userId')
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateWorkspaceMemberSchema)) input: UpdateWorkspaceMemberInput,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.updateMember(workspaceId, userId, input, actor); }

  @Delete(':userId')
  remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.removeMember(workspaceId, userId, actor); }

  @Get(':userId/permissions')
  permissions(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.getPermissions(workspaceId, userId, actor); }

  @Put(':userId/permissions')
  replacePermissions(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(replacePermissionsSchema)) input: ReplacePermissionsInput,
    @CurrentUser() actor: Principal,
  ) { return this.workspaces.replacePermissions(workspaceId, userId, input, actor); }
}

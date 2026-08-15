import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createProjectUserSchema, CreateProjectUserInput, updateProjectUserSchema, UpdateProjectUserInput } from './users.schemas';
import { UsersService } from './users.service';

@Roles('CLIENT_ADMIN')
@TenantScoped()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: Principal) { return this.users.list(actor); }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal) { return this.users.get(id, actor); }

  @Post()
  create(@Body(new ZodValidationPipe(createProjectUserSchema)) input: CreateProjectUserInput, @CurrentUser() actor: Principal) {
    return this.users.create(input, actor);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateProjectUserSchema)) input: UpdateProjectUserInput, @CurrentUser() actor: Principal) {
    return this.users.update(id, input, actor);
  }
}

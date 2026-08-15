import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { updateUserAccessSchema, UpdateUserAccessInput } from './users.schemas';
import { UsersService } from './users.service';

@Roles('SUPER_ADMIN')
@Controller('user-access')
export class UserAccessController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: Principal) {
    return this.users.listAccess(actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserAccessSchema)) input: UpdateUserAccessInput,
    @CurrentUser() actor: Principal
  ) {
    return this.users.updateAccess(id, input, actor);
  }
}

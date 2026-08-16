import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Patch, Put, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PreferencesService } from './preferences.service';
import { changePasswordSchema, ChangePasswordInput, updateAvatarSchema, UpdateAvatarInput } from './preferences.schemas';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER')
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  profile(@CurrentUser() actor: Principal) {
    return this.preferences.profile(actor);
  }

  @Get('avatar')
  @Header('Cache-Control', 'private, max-age=3600')
  @Header('X-Content-Type-Options', 'nosniff')
  async avatar(@CurrentUser() actor: Principal) {
    const avatar = await this.preferences.avatar(actor);
    return new StreamableFile(avatar.data, {
      type: avatar.mimeType,
      disposition: 'inline',
      length: avatar.data.length,
    });
  }

  @Put('avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updateAvatar(
    @Body(new ZodValidationPipe(updateAvatarSchema)) input: UpdateAvatarInput,
    @CurrentUser() actor: Principal,
  ) {
    return this.preferences.updateAvatar(input, actor);
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@CurrentUser() actor: Principal) {
    return this.preferences.removeAvatar(actor);
  }

  @Patch('password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
    @CurrentUser() actor: Principal,
  ) {
    return this.preferences.changePassword(input, actor);
  }
}

import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CsrfExempt } from '../common/decorators/csrf-exempt.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Principal } from '../common/types/principal';
import { newCsrfToken } from '../common/security';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { LoginInput, loginSchema } from './auth.schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Public()
  @CsrfExempt()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input, this.sessionContext(request));
    this.setRefreshCookie(response, result.refreshToken);
    this.setCsrfCookie(response);
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = request.cookies?.[this.refreshCookieName()] as string | undefined;
    if (!rawToken) throw new UnauthorizedException('Sessão ausente.');
    const result = await this.auth.refresh(rawToken, this.sessionContext(request));
    this.setRefreshCookie(response, result.refreshToken);
    this.setCsrfCookie(response);
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[this.refreshCookieName()] as string | undefined);
    response.clearCookie(this.refreshCookieName(), this.cookieOptions());
    response.clearCookie('XSRF-TOKEN', this.csrfCookieOptions());
    return { success: true };
  }

  @Get('me')
  @Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'PROJECT_USER')
  me(@CurrentUser() user: Principal) {
    const { tokenVersion: _tokenVersion, ...safe } = user;
    return safe;
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie(this.refreshCookieName(), token, {
      ...this.cookieOptions(),
      maxAge: this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400_000
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'strict' as const,
      // __Host- cookies require Secure, Path=/ and no Domain.
      path: this.config.get<string>('NODE_ENV') === 'production' ? '/' : '/api/v1/auth'
    };
  }

  private refreshCookieName() {
    return this.config.get<string>('NODE_ENV') === 'production' ? '__Host-personaia_refresh' : 'personaia_refresh';
  }

  private setCsrfCookie(response: Response) {
    response.cookie('XSRF-TOKEN', newCsrfToken(), {
      ...this.csrfCookieOptions(),
      maxAge: this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400_000
    });
  }

  private csrfCookieOptions() {
    return {
      httpOnly: false,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'strict' as const,
      path: '/'
    };
  }

  private sessionContext(request: Request) {
    return { userAgent: request.get('user-agent'), ipAddress: request.ip };
  }
}

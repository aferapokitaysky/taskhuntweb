import { Body, Controller, Delete, Get, Ip, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ConfirmTotpDto, DisableTotpDto, VerifyTotpDto } from './dto/totp.dto';
import { GoogleInitGuard, GithubInitGuard, AppleInitGuard } from './guards/oauth-init.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { RequestMeta } from './auth.service';

function requestMeta(req: Request): RequestMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string, @Req() req: Request) {
    return this.authService.register(dto, ip, requestMeta(req));
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.authService.refresh(refreshToken, requestMeta(req));
  }

  // --- Верификация email ---

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.sendVerificationEmail(user.id, user.email);
  }

  // --- Восстановление пароля ---

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    // Намеренно один и тот же ответ независимо от того, найден email или
    // нет — иначе эндпоинт становится инструментом проверки "зарегистрирован
    // ли этот email на TaskHunt" (user enumeration).
    return { message: 'Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-password')
  setPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPasswordDto) {
    return this.authService.setPassword(user.id, dto.newPassword);
  }

  // --- 2FA (TOTP) ---

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enroll')
  enrollTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.enrollTotp(user.id, user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enroll/confirm')
  confirmTotpEnrollment(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmTotpDto) {
    return this.authService.confirmTotpEnrollment(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTotp(@CurrentUser() user: AuthenticatedUser, @Body() dto: DisableTotpDto) {
    return this.authService.disableTotp(user.id, dto.password);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('2fa/verify')
  verifyTotp(@Body() dto: VerifyTotpDto) {
    return this.authService.verifyTotp(dto.totpToken, dto.code);
  }

  // --- Активные сессии ---

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.authService.revokeSession(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeOtherSessions(user.id, user.sessionId);
  }

  // --- Google ---
  // Фронт зовёт GET /auth/google?role=CLIENT|FREELANCER — редирект на Google.

  @UseGuards(GoogleInitGuard)
  @Get('google')
  googleAuth() {
    // тело не нужно: guard сам делает redirect на Google
  }

  @UseGuards(GoogleInitGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  // --- GitHub ---

  @UseGuards(GithubInitGuard)
  @Get('github')
  githubAuth() {}

  @UseGuards(GithubInitGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  // --- Apple ---
  // Apple использует response_mode=form_post — колбэк приходит POST-ом.

  @UseGuards(AppleInitGuard)
  @Get('apple')
  appleAuth() {}

  @UseGuards(AppleInitGuard)
  @Post('apple/callback')
  async appleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  /**
   * После успешной OAuth-аутентификации отдаём токены редиректом на
   * фронтенд с параметрами в query (фронт сам сохранит их в localStorage
   * на странице /oauth/callback и перенаправит на /onboarding или /dashboard).
   */
  private async finishOAuth(req: Request, res: Response) {
    const tokens = await this.authService.handleOAuthLogin(req.user as any, requestMeta(req));
    const webUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';
    res.redirect(
      `${webUrl}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }
}

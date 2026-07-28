import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleInitGuard, GithubInitGuard, AppleInitGuard } from './guards/oauth-init.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
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
    const tokens = await this.authService.handleOAuthLogin(req.user as any);
    const webUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';
    res.redirect(
      `${webUrl}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { decodeOAuthState } from './oauth-state.util';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    // Фолбэки нужны, чтобы приложение не падало на старте, если Google OAuth
    // ещё не настроен (пустой clientID роняет конструктор OAuth2Strategy) —
    // сам логин через Google при этом просто не будет работать, пока не
    // проставят реальные GOOGLE_CLIENT_ID/SECRET в .env.
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'unconfigured-google-client-id',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'unconfigured-google-client-secret',
      callbackURL: `${config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'}/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  // role приходит через `state` (см. AuthController.googleAuth) — единственный
  // способ протащить "заказчик/фрилансер" через redirect на Google и обратно.
  async validate(req: Request, _accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const state = decodeOAuthState(req.query.state as string | undefined);
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Google account has no public email'), false);

    done(null, {
      provider: 'GOOGLE' as const,
      oauthId: profile.id,
      email,
      displayName: profile.displayName ?? email,
      role: state.role,
    });
  }
}

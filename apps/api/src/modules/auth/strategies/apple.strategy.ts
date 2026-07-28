import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// @ts-expect-error — у passport-apple нет актуальных типов, интерфейс стабилен с версии 2.x
import { Strategy } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { decodeOAuthState } from './oauth-state.util';

/**
 * Apple Sign In отличается от Google/GitHub: работает через `response_mode:
 * "form_post"` (POST на callback, а не GET), имя пользователя приходит
 * только при ПЕРВОЙ авторизации (в req.body.user, JSON-строка) — дальше
 * Apple его больше не присылает, поэтому displayName на повторных входах
 * может быть пустым и его придётся спросить у пользователя отдельно.
 */
@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(config: ConfigService) {
    // См. комментарий в google.strategy.ts — фолбэки, чтобы не падать на
    // старте без настроенного Apple Developer аккаунта (team/key/privateKey).
    super({
      clientID: config.get<string>('APPLE_CLIENT_ID') || 'unconfigured-apple-client-id',
      teamID: config.get<string>('APPLE_TEAM_ID') || 'unconfigured',
      keyID: config.get<string>('APPLE_KEY_ID') || 'unconfigured',
      privateKeyString: config.get<string>('APPLE_PRIVATE_KEY') || undefined,
      callbackURL: `${config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'}/auth/apple/callback`,
      scope: ['email', 'name'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    idTokenClaims: { sub: string; email?: string },
    _profile: unknown,
    done: (err: any, user?: any) => void,
  ) {
    const state = decodeOAuthState(req.query.state as string | undefined);

    let displayName = idTokenClaims.email ?? 'Apple User';
    if (typeof req.body?.user === 'string') {
      try {
        const parsed = JSON.parse(req.body.user);
        displayName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ') || displayName;
      } catch {
        // Apple не прислал user на этот раз (не первый вход) — оставляем displayName по умолчанию
      }
    }

    if (!idTokenClaims.email) {
      return done(new Error('Apple did not return an email in the id_token'), false);
    }

    done(null, {
      provider: 'APPLE' as const,
      oauthId: idTokenClaims.sub,
      email: idTokenClaims.email,
      displayName,
      role: state.role,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { decodeOAuthState } from './oauth-state.util';

/**
 * GitHub — не только способ логина, но и то, что потом отображается
 * "красиво" на карточке профиля (githubUrl в Profile). При первом входе
 * через GitHub сразу проставляем profile.githubUrl из данных провайдера.
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    // См. комментарий в google.strategy.ts — фолбэки, чтобы не падать на старте без настроенного OAuth.
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') || 'unconfigured-github-client-id',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') || 'unconfigured-github-client-secret',
      callbackURL: `${config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'}/auth/github/callback`,
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ) {
    const state = decodeOAuthState(req.query.state as string | undefined);
    const email = profile.emails?.[0]?.value ?? `${profile.username}@users.noreply.github.com`;

    done(null, {
      provider: 'GITHUB' as const,
      oauthId: String(profile.id),
      email,
      displayName: profile.displayName ?? profile.username,
      githubUrl: profile.profileUrl,
      role: state.role,
    });
  }
}

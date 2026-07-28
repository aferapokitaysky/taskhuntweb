import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { encodeOAuthState } from '../strategies/oauth-state.util';

/**
 * Общий guard-фабрика для старта OAuth-флоу (Google/GitHub/Apple): читает
 * `?role=CLIENT|FREELANCER` из query исходного запроса и кладёт его в
 * OAuth `state`, чтобы получить обратно в callback (см. oauth-state.util.ts).
 */
function createOAuthInitGuard(provider: string) {
  @Injectable()
  class OAuthInitGuard extends AuthGuard(provider) {
    getAuthenticateOptions(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      const role = req.query.role === 'FREELANCER' ? 'FREELANCER' : 'CLIENT';
      return { state: encodeOAuthState(role) };
    }
  }
  return OAuthInitGuard;
}

export class GoogleInitGuard extends createOAuthInitGuard('google') {}
export class GithubInitGuard extends createOAuthInitGuard('github') {}
export class AppleInitGuard extends createOAuthInitGuard('apple') {}

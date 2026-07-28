import { MarketplaceRole } from '@prisma/client';

export interface OAuthState {
  role: MarketplaceRole;
}

/**
 * Роль (CLIENT/FREELANCER) выбирается на форме регистрации ДО редиректа на
 * провайдера — прокидываем её через стандартный OAuth2 `state`-параметр
 * (base64 JSON), т.к. это единственный слот, который провайдер обязан
 * вернуть нам обратно нетронутым.
 */
export function encodeOAuthState(role: MarketplaceRole): string {
  return Buffer.from(JSON.stringify({ role })).toString('base64url');
}

export function decodeOAuthState(state: string | undefined): OAuthState {
  if (!state) return { role: 'CLIENT' };
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    return { role: parsed.role === 'FREELANCER' ? 'FREELANCER' : 'CLIENT' };
  } catch {
    return { role: 'CLIENT' };
  }
}

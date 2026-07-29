import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';

@Injectable()
export class SubscriptionAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id || (req.ips?.length ? req.ips[0] : req.ip);
  }

  protected async getLimit(context: ExecutionContext, limitProps: ThrottlerOptions): Promise<number> {
    const req = context.switchToHttp().getRequest();
    const tierName = req.user?.subscription?.tier?.name || 'STARTER';

    const defaultLimit = typeof limitProps.limit === 'number' ? limitProps.limit : 100;

    if (tierName === 'PREMIUM') {
      return defaultLimit * 4;
    }
    if (tierName === 'PRO') {
      return defaultLimit * 2;
    }
    return defaultLimit;
  }
}

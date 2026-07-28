import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventName, InvoicePaidEvent } from '@taskhunt/shared-types';
import { ReferralsService } from './referrals.service';

@Injectable()
export class ReferralsEventsListener {
  constructor(private readonly referralsService: ReferralsService) {}

  @OnEvent(DomainEventName.InvoicePaid)
  async onInvoicePaid(event: InvoicePaidEvent) {
    if (!event?.payload?.payerId || !event?.payload?.amount) {
      return;
    }

    await this.referralsService.processReferralReward(
      event.payload.payerId,
      event.payload.amount,
    );
  }
}

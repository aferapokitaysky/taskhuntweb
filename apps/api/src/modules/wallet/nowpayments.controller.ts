import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { NowPaymentsService } from './nowpayments.service';
import { InvoiceService } from './invoice.service';
import { DepositService } from './deposit.service';

@Controller('wallet/nowpayments')
export class NowPaymentsController {
  constructor(
    private readonly nowPayments: NowPaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly depositService: DepositService,
  ) {}

  /**
   * Вебхук NOWPayments. НИКОГДА не доверяем телу запроса без проверки
   * подписи — иначе кто угодно может дёрнуть этот урл и "оплатить" эскроу
   * без реальных денег.
   */
  @Post('ipn')
  @HttpCode(200)
  async handleIpn(@Body() body: Record<string, unknown>, @Headers('x-nowpayments-sig') signature: string) {
    if (!signature || !this.nowPayments.verifyIpnSignature(body, signature)) {
      throw new BadRequestException('Invalid IPN signature');
    }

    const status = body.payment_status as string;
    const paymentId = body.payment_id as string;

    if (status === 'finished' || status === 'confirmed') {
      // Один payment_id пространство на оба типа платежей (invoice-эскроу и
      // пополнение кошелька) — сначала проверяем депозит (не бросает, если
      // не найден), иначе это счёт по заказу.
      const deposit = await this.depositService.markPaid(paymentId);
      if (!deposit) {
        await this.invoiceService.markPaidAndLockEscrow(paymentId);
      }
    }

    return { received: true };
  }
}

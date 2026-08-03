import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface CreatePaymentResult {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
}

/**
 * Тонкий клиент над NOWPayments API. Реальные HTTP-вызовы — через fetch,
 * без лишних абстракций: это internal integration, а не публичный SDK.
 */
@Injectable()
export class NowPaymentsService {
  private readonly logger = new Logger(NowPaymentsService.name);
  private readonly apiKey: string;
  private readonly ipnSecret: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('NOWPAYMENTS_API_KEY') ?? '';
    this.ipnSecret = config.get<string>('NOWPAYMENTS_IPN_SECRET') ?? '';
    this.baseUrl = config.get<string>('NOWPAYMENTS_BASE_URL') ?? 'https://api.nowpayments.io/v1';
  }

  async createPayment(params: {
    priceAmount: number;
    priceCurrency: string;
    payCurrency: string;
    orderId: string;
    ipnCallbackUrl: string;
  }): Promise<CreatePaymentResult> {
    const res = await fetch(`${this.baseUrl}/payment`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: params.priceAmount,
        price_currency: params.priceCurrency,
        pay_currency: params.payCurrency,
        order_id: params.orderId,
        ipn_callback_url: params.ipnCallbackUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`createPayment failed: ${res.status} ${body}`);
      // AMOUNT_MINIMAL_ERROR — это не сбой провайдера, а невалидный ввод
      // (сумма счёта конвертируется в меньше минимально принимаемого
      // провайдером объёма крипты). Раньше это тоже летело как 503
      // "провайдер недоступен" — пользователь не понимал, что нужно просто
      // увеличить сумму, и пробовал снова с той же суммой.
      if (body.includes('AMOUNT_MINIMAL_ERROR')) {
        throw new BadRequestException('Сумма слишком мала для оплаты в криптовалюте — минимальный платёж провайдера обычно около $10. Увеличьте сумму.');
      }
      // Остальные ошибки провайдера — 503, не течём деталями наружу.
      throw new ServiceUnavailableException('Платёжный провайдер временно недоступен. Попробуйте выставить счёт позже.');
    }

    const data = await res.json();
    return {
      paymentId: data.payment_id,
      payAddress: data.pay_address,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
    };
  }

  async createPayout(params: {
    address: string;
    amount: number;
    currency?: string;
    ipnCallbackUrl?: string;
  }): Promise<{ id: string; status: string }> {
    const res = await fetch(`${this.baseUrl}/payout`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawals: [
          {
            address: params.address,
            amount: params.amount,
            currency: params.currency ?? 'usd',
            ipn_callback_url: params.ipnCallbackUrl,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`createPayout failed: ${res.status} ${body}`);
      throw new ServiceUnavailableException('Платёжный провайдер временно недоступен. Выплата будет повторена позже.');
    }

    const data = await res.json();
    return {
      id: data.id ?? data.payout_id ?? 'payout-ok',
      status: data.status ?? 'PROCESSING',
    };
  }

  /**
   * IPN-подпись NOWPayments: HMAC-SHA512 от JSON-тела с отсортированными
   * по алфавиту ключами (см. их доку "IPN — Instant Payment Notifications").
   * Без этой проверки любой может подделать вебхук "оплата прошла".
   */
  verifyIpnSignature(rawBody: Record<string, unknown>, signatureHeader: string): boolean {
    const sorted = this.sortObjectKeys(rawBody);
    const hmac = crypto.createHmac('sha512', this.ipnSecret);
    hmac.update(JSON.stringify(sorted));
    const expected = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        const value = obj[key];
        acc[key] =
          value && typeof value === 'object' && !Array.isArray(value)
            ? this.sortObjectKeys(value as Record<string, unknown>)
            : value;
        return acc;
      }, {} as Record<string, unknown>);
  }
}

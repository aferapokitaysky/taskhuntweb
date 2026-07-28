import { Injectable } from '@nestjs/common';
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
      throw new Error(`NOWPayments createPayment failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return {
      paymentId: data.payment_id,
      payAddress: data.pay_address,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
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

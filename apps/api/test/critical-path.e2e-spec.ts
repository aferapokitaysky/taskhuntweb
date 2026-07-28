import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NowPaymentsService } from '../src/modules/wallet/nowpayments.service';

describe('Critical Path E2E (Order -> Bid -> Invoice -> Escrow -> Release)', () => {
  let app: INestApplication;
  let clientToken: string;
  let freelancerToken: string;
  let categoryId: string;
  let orderId: string;
  let bidId: string;
  let invoiceId: string;
  let nowPaymentsPaymentId: string;

  const mockNowPayments = {
    createPayment: jest.fn().mockResolvedValue({
      paymentId: 'np-pay-123',
      payAddress: '0x123abc',
      payAmount: 100,
      payCurrency: 'usdt',
    }),
    createPayout: jest.fn().mockResolvedValue({
      id: 'payout-123',
      status: 'PROCESSING',
    }),
    verifyIpnSignature: jest.fn().mockReturnValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NowPaymentsService)
      .useValue(mockNowPayments)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Register Client', async () => {
    const email = `client_${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        role: 'CLIENT',
        displayName: 'E2E Client',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    clientToken = res.body.accessToken;
  });

  it('2. Register Freelancer', async () => {
    const email = `freelancer_${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        role: 'FREELANCER',
        displayName: 'E2E Freelancer',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    freelancerToken = res.body.accessToken;
  });

  it('3. Client creates Order', async () => {
    const categoriesRes = await request(app.getHttpServer()).get('/categories').expect(200);
    // categoryId обязателен на CreateOrderDto (@IsUUID) — берём реальную
    // засеянную категорию, а не выдумываем строку
    categoryId = categoriesRes.body[0]?.children?.[0]?.id ?? categoriesRes.body[0]?.id;
    expect(categoryId).toBeDefined();

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        categoryId,
        title: 'Fullstack Next.js App',
        description: 'Build a production web application with NestJS backend',
        budgetMin: 100,
        budgetMax: 200,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    orderId = res.body.id;
  });

  it('4. Freelancer submits Bid', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        amount: 150,
        deliveryDays: 5,
        message: 'I can complete this project quickly',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    bidId = res.body.id;
  });

  it('5. Client accepts Bid', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/bids/${bidId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(201);

    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('6. Freelancer issues Invoice', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallet/invoices')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        orderId,
        amount: 150,
        description: 'Initial deposit invoice',
      })
      .expect(201);

    // InvoiceService.issueInvoice() возвращает { invoice, payment }, не сам инвойс напрямую
    expect(res.body.invoice?.id).toBeDefined();
    invoiceId = res.body.invoice.id;
    nowPaymentsPaymentId = res.body.payment.paymentId;
  });

  it('7. Simulate IPN payment confirmation', async () => {
    // NowPaymentsController ищет инвойс по payment_id (== nowPaymentsPaymentId
    // в БД), а не по order_id — это и есть настоящий контракт вебхука
    const res = await request(app.getHttpServer())
      .post('/wallet/nowpayments/ipn')
      .set('x-nowpayments-sig', 'valid-sig')
      .send({
        payment_id: nowPaymentsPaymentId,
        payment_status: 'finished',
        pay_amount: 150,
      })
      .expect(200);

    expect(res.body.received).toBe(true);
  });

  it('8. Freelancer delivers work', async () => {
    // POST .../deliver возвращает созданную запись Delivery (id/description/
    // notes/versionNumber), а не заказ целиком — статус заказа проверяем
    // отдельным GET ниже, а не из этого ответа
    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        // DeliverWorkDto ожидает "description" (мин. 5 симв.), не "comment" —
        // с forbidNonWhitelisted:true лишнее поле само по себе роняет запрос
        description: 'Work completed, repository link attached.',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();

    const orderRes = await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(200);
    expect(orderRes.body.status).toBe('IN_REVIEW');
  });

  it('9. Client approves work & releases escrow', async () => {
    // approve() возвращает { released: true, invoiceId }, не заказ —
    // статус заказа снова проверяем отдельным GET
    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(201);

    expect(res.body.released).toBe(true);

    const orderRes = await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(200);
    expect(orderRes.body.status).toBe('COMPLETED');
  });

  it('10. Verify Freelancer balance increased by net amount (amount minus 10% commission)', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallet/balance')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .expect(200);

    // 150 minus 10% commission = 135
    expect(Number(res.body.withdrawableBalance)).toBe(135);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Matching E2E (ранжирование откликов и персональная лента)', () => {
  let app: INestApplication;
  let clientToken: string;
  let freelancerToken: string;
  let categoryId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('готовит заказчика, фрилансера, заказ и отклик', async () => {
    const clientEmail = `matching_client_${Date.now()}@example.com`;
    const clientRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: clientEmail, password: 'Password123!', role: 'CLIENT', displayName: 'Matching Client' })
      .expect(201);
    clientToken = clientRes.body.accessToken;

    const freelancerEmail = `matching_freelancer_${Date.now()}@example.com`;
    const freelancerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: freelancerEmail, password: 'Password123!', role: 'FREELANCER', displayName: 'Matching Freelancer' })
      .expect(201);
    freelancerToken = freelancerRes.body.accessToken;

    const categoriesRes = await request(app.getHttpServer()).get('/categories').expect(200);
    categoryId = categoriesRes.body[0]?.children?.[0]?.id ?? categoriesRes.body[0]?.id;
    expect(categoryId).toBeDefined();

    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        categoryId,
        title: 'Matching Engine Test Order',
        description: 'Заказ для проверки ранжирования откликов и рекомендаций',
        budgetMin: 100,
        budgetMax: 200,
      })
      .expect(201);
    orderId = orderRes.body.id;

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ amount: 150, deliveryDays: 5, message: 'Готов взяться' })
      .expect(201);
  });

  it('заказчик видит ранжированные отклики со score и причинами', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}/recommended-freelancers`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].matchScore).toBeGreaterThan(0);
    expect(Array.isArray(res.body[0].matchReasons)).toBe(true);
    expect(res.body[0].matchReasons).toContain('Цена в рамках бюджета');
  });

  it('чужой заказчик не может увидеть чужие отклики (403)', async () => {
    const otherEmail = `matching_other_${Date.now()}@example.com`;
    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password: 'Password123!', role: 'CLIENT', displayName: 'Other Client' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/orders/${orderId}/recommended-freelancers`)
      .set('Authorization', `Bearer ${otherRes.body.accessToken}`)
      .expect(403);
  });

  it('фрилансер получает персональную ленту рекомендованных заказов', async () => {
    const res = await request(app.getHttpServer())
      .get('/freelancers/me/recommended-orders')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((o: any) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found.matchScore).toBeGreaterThan(0);
  });

  it('клиент не может открыть персональную ленту фрилансера (403 — RolesGuard)', async () => {
    await request(app.getHttpServer())
      .get('/freelancers/me/recommended-orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });
});

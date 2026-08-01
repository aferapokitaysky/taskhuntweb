import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let walletService: { releaseEscrow: jest.Mock; refundEscrow: jest.Mock; getSystemWalletId: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(10),
      },
      profile: {
        count: jest.fn().mockResolvedValue(5),
      },
      dispute: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
      },
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      supportMessage: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn((arg: unknown[] | ((tx: unknown) => Promise<unknown>)) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
      bid: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 }, _avg: { amount: 100 } }),
      },
      ledgerEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([{ status: 'OPEN', _count: { id: 3 } }]),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(5),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      skill: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      featureFlag: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      commissionRule: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    walletService = {
      releaseEscrow: jest.fn().mockResolvedValue(undefined),
      refundEscrow: jest.fn().mockResolvedValue(undefined),
      getSystemWalletId: jest.fn().mockResolvedValue('system-wallet-id'),
    };

    service = new AdminService(prisma, walletService as any);
  });

  describe('getMetrics', () => {
    it('возвращает сводную аналитику платформы со всеми необходимыми полями', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty('revenue');
      expect(metrics).toHaveProperty('gmv');
      expect(metrics).toHaveProperty('avgOrderValue');
      expect(metrics).toHaveProperty('avgTimeToHireHours');
      expect(metrics).toHaveProperty('avgDisputeResolutionHours');
      expect(metrics).toHaveProperty('subscriptionChurnRate');
      expect(metrics).toHaveProperty('activeDisputes');
      expect(metrics).toHaveProperty('ordersByStatus');
      expect(metrics.ordersByStatus.OPEN).toBe(3);
    });
  });

  describe('getRevenueTimeseries', () => {
    it('возвращает непрерывный временной ряд по дням', async () => {
      const res = await service.getRevenueTimeseries(7);

      expect(res).toHaveLength(7);
      expect(res[0]).toHaveProperty('date');
      expect(res[0]).toHaveProperty('revenue');
      expect(res[0]).toHaveProperty('gmv');
      expect(res[0]).toHaveProperty('newUsers');
      expect(res[0]).toHaveProperty('newOrders');
    });
  });

  describe('getFunnel', () => {
    it('рассчитывает показатели конверсии воронки пользователей', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.profile.count.mockResolvedValue(1);

      const funnel = await service.getFunnel(30);

      expect(funnel.registered).toBe(2);
      expect(funnel.onboarded).toBe(1);
    });
  });

  describe('getTopCategories', () => {
    it('возвращает топы категорий отсортированные по GMV', async () => {
      prisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Web Dev',
          orders: [
            {
              invoices: [{ amount: 300 }],
            },
          ],
        },
      ]);

      const res = await service.getTopCategories(5);

      expect(res).toHaveLength(1);
      expect(res[0].categoryName).toBe('Web Dev');
      expect(res[0].gmv).toBe(300);
    });
  });

  describe('resolveDispute', () => {
    it('бросает NotFoundException, если спор не найден', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveDispute('disp-999', 'staff-1', {
          resolution: 'RESOLVED_CLIENT',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает BadRequestException, если по заказу нет оплаченного инвойса (PAID)', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        orderId: 'order-1',
        order: { client: { wallet: { id: 'client-wallet-id' } } },
      });
      prisma.bid.findFirst.mockResolvedValue({
        freelancerId: 'freelancer-1',
        freelancer: { wallet: { id: 'freelancer-wallet-id' } },
      });
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveDispute('disp-1', 'staff-1', {
          resolution: 'RESOLVED_CLIENT',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(walletService.releaseEscrow).not.toHaveBeenCalled();
      expect(walletService.refundEscrow).not.toHaveBeenCalled();
    });

    it('при resolution: RESOLVED_FREELANCER вызывает releaseEscrow и обновляет спор', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        orderId: 'order-1',
        order: { client: { wallet: { id: 'client-wallet-id' } } },
      });
      prisma.bid.findFirst.mockResolvedValue({
        freelancerId: 'freelancer-1',
        freelancer: { wallet: { id: 'freelancer-wallet-id' } },
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-100',
        amount: '250.00',
      });
      prisma.dispute.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'disp-1', ...data }),
      );

      const res = await service.resolveDispute('disp-1', 'staff-1', {
        resolution: 'RESOLVED_FREELANCER',
        notes: 'Work was delivered according to specs',
      });

      expect(walletService.releaseEscrow).toHaveBeenCalledWith({
        clientWalletId: 'client-wallet-id',
        freelancerWalletId: 'freelancer-wallet-id',
        amount: 250,
        invoiceId: 'inv-100',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
      });
      expect(walletService.refundEscrow).not.toHaveBeenCalled();

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'disp-1' },
        data: expect.objectContaining({
          status: 'RESOLVED_FREELANCER',
          resolutionNotes: 'Work was delivered according to specs',
          resolvedAt: expect.any(Date),
        }),
      });
      expect(res.status).toBe('RESOLVED_FREELANCER');
    });

    it('при resolution: RESOLVED_CLIENT вызывает refundEscrow и обновляет спор', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        orderId: 'order-1',
        order: { client: { wallet: { id: 'client-wallet-id' } } },
      });
      prisma.bid.findFirst.mockResolvedValue({
        freelancerId: 'freelancer-1',
        freelancer: { wallet: { id: 'freelancer-wallet-id' } },
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-100',
        amount: '250.00',
      });
      prisma.dispute.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'disp-1', ...data }),
      );

      const res = await service.resolveDispute('disp-1', 'staff-1', {
        resolution: 'RESOLVED_CLIENT',
        notes: 'Freelancer went missing',
      });

      expect(walletService.refundEscrow).toHaveBeenCalledWith({
        clientWalletId: 'client-wallet-id',
        amount: 250,
        invoiceId: 'inv-100',
      });
      expect(walletService.releaseEscrow).not.toHaveBeenCalled();

      expect(res.status).toBe('RESOLVED_CLIENT');
    });
  });
});

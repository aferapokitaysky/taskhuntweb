import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let walletService: { releaseEscrow: jest.Mock; refundEscrow: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      dispute: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      bid: {
        findFirst: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
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
    };

    service = new AdminService(prisma, walletService as any);
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
      prisma.invoice.findFirst.mockResolvedValue(null); // нет оплаченного инвойса

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

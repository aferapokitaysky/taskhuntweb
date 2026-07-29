import { NotFoundException } from '@nestjs/common';
import { FraudService } from '../fraud.service';

describe('FraudService', () => {
  let prisma: any;
  let service: FraudService;

  beforeEach(() => {
    prisma = {
      fraudFlag: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn() },
    };
    service = new FraudService(prisma);
  });

  describe('createFlag', () => {
    it('создаёт флаг и не уведомляет staff при низком severity', async () => {
      prisma.fraudFlag.create.mockResolvedValue({ id: 'flag-1', eventName: 'OrderCreated', riskScore: 20, severity: 'LOW' });

      await service.createFlag({ eventName: 'OrderCreated', riskScore: 20, severity: 'LOW', reasons: ['small_budget'] });

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('уведомляет всех staff с fraud.review при CRITICAL severity', async () => {
      prisma.fraudFlag.create.mockResolvedValue({ id: 'flag-2', eventName: 'DisputeOpened', riskScore: 90, severity: 'CRITICAL' });
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-1' }, { id: 'staff-2' }]);

      await service.createFlag({ eventName: 'DisputeOpened', riskScore: 90, severity: 'CRITICAL', reasons: ['repeat_dispute'] });

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: 'staff-1', eventName: 'FraudFlagCreated' }),
          expect.objectContaining({ userId: 'staff-2', eventName: 'FraudFlagCreated' }),
        ],
      });
    });

    it('не падает, если у CRITICAL-флага некому уведомлять (нет staff с правом)', async () => {
      prisma.fraudFlag.create.mockResolvedValue({ id: 'flag-3', eventName: 'BidAccepted', riskScore: 80, severity: 'HIGH' });
      prisma.user.findMany.mockResolvedValue([]);

      await expect(
        service.createFlag({ eventName: 'BidAccepted', riskScore: 80, severity: 'HIGH', reasons: [] }),
      ).resolves.toBeDefined();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('бросает NotFoundException для несуществующего флага', async () => {
      prisma.fraudFlag.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('missing-id', 'staff-1', 'DISMISSED')).rejects.toThrow(NotFoundException);
    });

    it('обновляет статус и фиксирует ревьюера', async () => {
      prisma.fraudFlag.findUnique.mockResolvedValue({ id: 'flag-1' });
      prisma.fraudFlag.update.mockResolvedValue({ id: 'flag-1', status: 'CONFIRMED' });

      await service.updateStatus('flag-1', 'staff-1', 'CONFIRMED', 'Подтверждено, дубликат аккаунта');

      expect(prisma.fraudFlag.update).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
        data: expect.objectContaining({ status: 'CONFIRMED', reviewedById: 'staff-1', reviewNote: 'Подтверждено, дубликат аккаунта' }),
      });
    });
  });
});

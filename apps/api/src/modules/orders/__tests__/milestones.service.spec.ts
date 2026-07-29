import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MilestonesService } from '../milestones.service';

/**
 * MilestonesService.approve() — второй (после WalletService) денежно-
 * критичный путь в системе: именно тут клиент реально отпускает эскроу
 * фрилансеру через приёмку работы. Ошибка здесь означает либо "фрилансер
 * не получил деньги за сделанную работу", либо "деньги ушли без приёмки" —
 * поэтому покрываем максимально дотошно, включая переход заказа в
 * COMPLETED только когда закрыты ВСЕ этапы.
 */
describe('MilestonesService', () => {
  let prisma: any;
  let wallet: { releaseEscrow: jest.Mock };
  let eventBus: { publish: jest.Mock };
  let service: MilestonesService;

  const clientId = 'client-1';
  const freelancerId = 'freelancer-1';
  const orderId = 'order-1';

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      milestone: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn(),
      },
      bid: {
        findFirst: jest.fn(),
      },
      delivery: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
      },
      invoice: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    wallet = { releaseEscrow: jest.fn().mockResolvedValue(undefined) };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const usersService = {
      incrementLateDeliveries: jest.fn(),
      recalculateSuccessMetrics: jest.fn(),
    };
    service = new MilestonesService(prisma, wallet as any, eventBus as any, usersService as any);
  });

  describe('create', () => {
    it('запрещает создавать этап на чужом заказе', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: orderId, clientId: 'other-client' });

      await expect(
        service.create(clientId, orderId, { title: 'Design', amount: 100, position: 0 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.milestone.create).not.toHaveBeenCalled();
    });
  });

  describe('deliver', () => {
    it('запрещает сдавать работу не принятому фрилансеру', async () => {
      prisma.bid.findFirst.mockResolvedValue({ freelancerId: 'someone-else' });

      await expect(
        service.deliver(freelancerId, orderId, null, { description: 'done' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('запрещает сдавать этап не в статусе FUNDED/IN_PROGRESS', async () => {
      prisma.bid.findFirst.mockResolvedValue({ freelancerId });
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', orderId, status: 'RELEASED' });

      await expect(
        service.deliver(freelancerId, orderId, 'm1', { description: 'done' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('сдача заказа целиком (без milestoneId) переводит заказ в IN_REVIEW и публикует WorkSubmitted', async () => {
      prisma.bid.findFirst.mockResolvedValue({ freelancerId });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ id: orderId, clientId });

      await service.deliver(freelancerId, orderId, null, { description: 'Готово' });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: 'IN_REVIEW' },
      });
      expect(prisma.milestone.update).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        'WorkSubmitted',
        expect.objectContaining({ orderId, submittedById: freelancerId, clientId }),
      );
    });

    it('сдача конкретного этапа переводит его в DELIVERED, не трогая статус заказа', async () => {
      prisma.bid.findFirst.mockResolvedValue({ freelancerId });
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', orderId, status: 'FUNDED' });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ id: orderId, clientId });

      await service.deliver(freelancerId, orderId, 'm1', { description: 'Готово' });

      expect(prisma.milestone.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'DELIVERED' } });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    function setupHappyPath(overrides: { milestoneId?: string | null } = {}) {
      prisma.order.findUnique.mockResolvedValue({
        id: orderId,
        clientId,
        client: { wallet: { id: 'client-wallet' } },
      });
      prisma.bid.findFirst.mockResolvedValue({
        freelancerId,
        freelancer: { wallet: { id: 'freelancer-wallet' } },
      });
      prisma.invoice.findFirst.mockResolvedValue({ id: 'invoice-1', amount: 100 });
      return overrides;
    }

    it('запрещает приёмку не своего заказа', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: orderId, clientId: 'other-client', client: { wallet: {} } });

      await expect(service.approve(clientId, orderId, null)).rejects.toBeInstanceOf(ForbiddenException);
      expect(wallet.releaseEscrow).not.toHaveBeenCalled();
    });

    it('падает, если нет оплаченного инвойса для заказа/этапа', async () => {
      setupHappyPath();
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.approve(clientId, orderId, null)).rejects.toBeInstanceOf(BadRequestException);
      expect(wallet.releaseEscrow).not.toHaveBeenCalled();
    });

    it('релизит эскроу и переводит заказ в COMPLETED, если этапов нет (простой флоу)', async () => {
      setupHappyPath();

      const result = await service.approve(clientId, orderId, null);

      expect(wallet.releaseEscrow).toHaveBeenCalledWith(
        expect.objectContaining({
          clientWalletId: 'client-wallet',
          freelancerWalletId: 'freelancer-wallet',
          amount: 100,
          invoiceId: 'invoice-1',
          orderId,
          freelancerId,
        }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: orderId }, data: { status: 'COMPLETED' } });
      expect(result).toEqual({ released: true, invoiceId: 'invoice-1' });
    });

    it('релизит конкретный этап и НЕ завершает заказ, если остались нерелизнутые этапы', async () => {
      setupHappyPath();
      prisma.milestone.count.mockResolvedValue(1); // остался ещё 1 нерелизнутый этап

      await service.approve(clientId, orderId, 'm1');

      expect(prisma.milestone.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'RELEASED' } });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('завершает заказ (COMPLETED), когда релизнут последний оставшийся этап', async () => {
      setupHappyPath();
      prisma.milestone.count.mockResolvedValue(0); // релизнутых не осталось — это был последний

      await service.approve(clientId, orderId, 'm2');

      expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: orderId }, data: { status: 'COMPLETED' } });
    });

    it('ищет инвойс именно для переданного milestoneId, а не любой оплаченный по заказу', async () => {
      setupHappyPath();
      prisma.milestone.count.mockResolvedValue(0);

      await service.approve(clientId, orderId, 'm2');

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderId, status: 'PAID', milestoneId: 'm2' } }),
      );
    });
  });
});

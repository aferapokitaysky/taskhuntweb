import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { DomainEventName } from '@taskhunt/shared-types';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    prisma = {
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      bid: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      chatThread: {
        create: jest.fn(),
      },
      dispute: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(prisma, eventBus as any);
  });

  describe('update', () => {
    it('бросает ForbiddenException, если пользователь пытается отредактировать чужой заказ', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'owner-user-id',
        status: 'OPEN',
      });

      await expect(
        service.update('another-user-id', 'order-1', { title: 'New Title' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('бросает BadRequestException, если статус заказа не OPEN и не DRAFT', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'owner-user-id',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.update('owner-user-id', 'order-1', { title: 'New Title' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('успешно обновляет заказ и создает новую версию при валидных правах и статусе', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'owner-user-id',
        status: 'OPEN',
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        clientId: 'owner-user-id',
        status: 'OPEN',
        title: 'New Title',
      });
      prisma.orderVersion.findFirst.mockResolvedValue({
        versionNumber: 1,
      });

      const res = await service.update('owner-user-id', 'order-1', {
        title: 'New Title',
      });

      expect(res.title).toBe('New Title');
      expect(prisma.orderVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          versionNumber: 2,
          editedById: 'owner-user-id',
        }),
      });
    });
  });

  describe('submitBid', () => {
    it('бросает BadRequestException, если заказ не в статусе OPEN', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.submitBid('freelancer-1', 'order-1', {
          amount: 100,
          deliveryDays: 3,
          message: 'Hi',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException, если клиент пытается откликнуться на свой же заказ', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        status: 'OPEN',
      });

      await expect(
        service.submitBid('client-1', 'order-1', {
          amount: 100,
          deliveryDays: 3,
          message: 'Hi',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptBid', () => {
    it('бросает BadRequestException, если заказ не в статусе OPEN', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.acceptBid('client-1', 'order-1', 'bid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('при принятии одного отклика переводит принятый в ACCEPTED, остальные PENDING в REJECTED, обновляет заказ и публикует BidAccepted', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        status: 'OPEN',
      });
      prisma.bid.findUnique.mockResolvedValue({
        id: 'bid-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
        amount: '150.00',
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: 'IN_PROGRESS',
        acceptedBidId: 'bid-1',
      });

      const res = await service.acceptBid('client-1', 'order-1', 'bid-1');

      expect(prisma.bid.update).toHaveBeenCalledWith({
        where: { id: 'bid-1' },
        data: { status: 'ACCEPTED' },
      });
      expect(prisma.bid.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', id: { not: 'bid-1' }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.chatThread.create).toHaveBeenCalledWith({
        data: { orderId: 'order-1' },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        DomainEventName.BidAccepted,
        expect.objectContaining({
          bidId: 'bid-1',
          orderId: 'order-1',
          freelancerId: 'freelancer-1',
          clientId: 'client-1',
          amount: 150,
        }),
      );
      expect(res.status).toBe('IN_PROGRESS');
    });
  });

  describe('openDispute', () => {
    it('бросает ForbiddenException, если спор открывает не участник заказа', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        bids: [{ freelancerId: 'freelancer-1', status: 'ACCEPTED' }],
      });

      await expect(
        service.openDispute('stranger-user-id', 'order-1', 'Some reason'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('создает спор, переводит заказ в DISPUTED и публикует DisputeOpened при вызове участником', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        bids: [{ freelancerId: 'freelancer-1', status: 'ACCEPTED' }],
      });
      prisma.dispute.create.mockResolvedValue({
        id: 'dispute-123',
        orderId: 'order-1',
        openedById: 'client-1',
        reason: 'Poor quality',
      });

      const result = await service.openDispute('client-1', 'order-1', 'Poor quality');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'DISPUTED' },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        DomainEventName.DisputeOpened,
        expect.objectContaining({
          disputeId: 'dispute-123',
          orderId: 'order-1',
          openedById: 'client-1',
          reason: 'Poor quality',
        }),
      );
      expect(result.id).toBe('dispute-123');
    });
  });
});

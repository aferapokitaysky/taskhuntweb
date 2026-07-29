import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
      },
      chatThread: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new ChatService(prisma);
  });

  describe('listMessages (создаёт/находит тред лениво)', () => {
    it('бросает NotFoundException, если заказ не найден', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.listMessages('order-1', 'freelancer-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException, если пользователь не клиент заказа и не сам фрилансер', async () => {
      prisma.order.findUnique.mockResolvedValue({
        clientId: 'client-1',
        bids: [{ status: 'PENDING', freelancerId: 'freelancer-1' }],
      });

      await expect(service.listMessages('order-1', 'freelancer-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('бросает ForbiddenException, если у фрилансера нет активного отклика на заказ', async () => {
      prisma.order.findUnique.mockResolvedValue({ clientId: 'client-1', bids: [] });

      await expect(service.listMessages('order-1', 'freelancer-1', 'client-1')).rejects.toThrow(ForbiddenException);
    });

    it('заказчик может открыть тред с откликнувшимся ещё до принятия (PENDING)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        clientId: 'client-1',
        bids: [{ status: 'PENDING', freelancerId: 'freelancer-1' }],
      });
      prisma.chatThread.upsert.mockResolvedValue({ id: 'thread-1' });
      prisma.chatMessage.findMany.mockResolvedValue([{ id: 'msg-1', body: 'Hello' }]);

      const msgs = await service.listMessages('order-1', 'freelancer-1', 'client-1');

      expect(msgs).toHaveLength(1);
      expect(prisma.chatThread.upsert).toHaveBeenCalledWith({
        where: { orderId_freelancerId: { orderId: 'order-1', freelancerId: 'freelancer-1' } },
        create: { orderId: 'order-1', freelancerId: 'freelancer-1' },
        update: {},
      });
    });

    it('фрилансер видит только свой тред', async () => {
      prisma.order.findUnique.mockResolvedValue({
        clientId: 'client-1',
        bids: [{ status: 'ACCEPTED', freelancerId: 'freelancer-1' }],
      });
      prisma.chatThread.upsert.mockResolvedValue({ id: 'thread-1' });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      await service.listMessages('order-1', 'freelancer-1', 'freelancer-1');
      expect(prisma.chatThread.upsert).toHaveBeenCalled();
    });
  });

  describe('softDeleteMessage', () => {
    it('бросает ForbiddenException, если пользователь удаляет чужое сообщение', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ id: 'msg-1', senderId: 'owner-1' });

      await expect(service.softDeleteMessage('msg-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });
});

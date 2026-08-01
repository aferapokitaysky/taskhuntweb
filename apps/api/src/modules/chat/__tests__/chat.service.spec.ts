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
      chatThreadRead: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notification: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
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

  describe('sendTextMessage', () => {
    it('создаёт уведомление получателю с deep link в нужный чат заказа', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        title: 'Landing page',
        clientId: 'client-1',
        bids: [{ status: 'ACCEPTED', freelancerId: 'freelancer-1' }],
      });
      prisma.chatThread.upsert.mockResolvedValue({ id: 'thread-1', orderId: 'order-1', freelancerId: 'freelancer-1' });
      prisma.chatMessage.create.mockResolvedValue({ id: 'msg-1', body: 'Привет, готов обсудить детали' });
      prisma.chatThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
        freelancer: { id: 'freelancer-1', email: 'pro@test.dev', profile: { displayName: 'Pro Designer' } },
        order: {
          id: 'order-1',
          title: 'Landing page',
          clientId: 'client-1',
          client: { id: 'client-1', email: 'client@test.dev', profile: { displayName: 'Client Team' } },
        },
      });

      await service.sendTextMessage('order-1', 'freelancer-1', 'freelancer-1', 'Привет, готов обсудить детали');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'client-1',
          title: 'Новое сообщение',
          message: 'Pro Designer написал по заказу "Landing page": Привет, готов обсудить детали',
          eventName: 'ChatMessageCreated',
          metadata: {
            orderId: 'order-1',
            freelancerId: 'freelancer-1',
            threadId: 'thread-1',
            messageId: 'msg-1',
            senderId: 'freelancer-1',
            href: '/chats?orderId=order-1&freelancerId=freelancer-1',
          },
        },
      });
    });
  });

  describe('sendFileMessage', () => {
    it('создаёт уведомление о файле с понятным превью и тем же deep link', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        title: 'Landing page',
        clientId: 'client-1',
        bids: [{ status: 'ACCEPTED', freelancerId: 'freelancer-1' }],
      });
      prisma.chatThread.upsert.mockResolvedValue({ id: 'thread-1', orderId: 'order-1', freelancerId: 'freelancer-1' });
      prisma.chatMessage.create.mockResolvedValue({ id: 'msg-file-1', body: 'Макет главного экрана' });
      prisma.chatThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
        freelancer: { id: 'freelancer-1', email: 'pro@test.dev', profile: { displayName: 'Pro Designer' } },
        order: {
          id: 'order-1',
          title: 'Landing page',
          clientId: 'client-1',
          client: { id: 'client-1', email: 'client@test.dev', profile: { displayName: 'Client Team' } },
        },
      });

      await service.sendFileMessage('order-1', 'freelancer-1', 'client-1', 'file-1', 'Макет главного экрана');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'freelancer-1',
          title: 'Новое сообщение',
          message: 'Client Team написал по заказу "Landing page": Файл: Макет главного экрана',
          eventName: 'ChatMessageCreated',
          metadata: expect.objectContaining({
            orderId: 'order-1',
            freelancerId: 'freelancer-1',
            threadId: 'thread-1',
            messageId: 'msg-file-1',
            senderId: 'client-1',
            href: '/chats?orderId=order-1&freelancerId=freelancer-1',
          }),
        }),
      });
    });
  });
});

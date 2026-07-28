import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      chatThread: {
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

  describe('listMessages', () => {
    it('бросает NotFoundException, если тред не найден', async () => {
      prisma.chatThread.findUnique.mockResolvedValue(null);

      await expect(service.listMessages('order-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException, если пользователь не является участником заказа', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        order: {
          clientId: 'client-1',
          bids: [{ freelancerId: 'freelancer-1' }],
        },
      });

      await expect(service.listMessages('order-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('возвращает сообщения для участника заказа', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        order: {
          clientId: 'client-1',
          bids: [{ freelancerId: 'freelancer-1' }],
        },
      });
      prisma.chatMessage.findMany.mockResolvedValue([{ id: 'msg-1', body: 'Hello' }]);

      const msgs = await service.listMessages('order-1', 'client-1');

      expect(msgs).toHaveLength(1);
      expect(msgs[0].body).toBe('Hello');
    });
  });

  describe('softDeleteMessage', () => {
    it('бросает ForbiddenException, если пользователь удаляет чужое сообщение', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ id: 'msg-1', senderId: 'owner-1' });

      await expect(service.softDeleteMessage('msg-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });
});

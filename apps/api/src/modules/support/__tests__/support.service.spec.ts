import { PermissionCode } from '@taskhunt/shared-types';
import { SupportService } from '../support.service';

describe('SupportService', () => {
  let prisma: any;
  let service: SupportService;

  beforeEach(() => {
    prisma = {
      supportTicket: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      supportMessage: { create: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn(), createMany: jest.fn() },
    };
    service = new SupportService(prisma);
  });

  it('уведомляет всех доступных staff о новом обращении', async () => {
    prisma.supportTicket.create.mockResolvedValue({ id: 'ticket-1', userId: 'client-1', subject: 'Payment issue', messages: [] });
    prisma.supportTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      userId: 'client-1',
      subject: 'Payment issue',
      assignedToId: null,
      user: { email: 'client@test.dev', profile: { displayName: 'Client Name' } },
      assignedTo: null,
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'staff-1' }, { id: 'staff-2' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 2 });

    await service.createTicket('client-1', { subject: 'Payment issue', message: 'Need help', priority: 'NORMAL' } as any);

    expect(prisma.supportTicket.create).toHaveBeenCalledWith({
      data: {
        userId: 'client-1',
        subject: 'Payment issue',
        priority: 'NORMAL',
        messages: { create: { senderId: 'client-1', body: 'Need help' } },
      },
      include: { messages: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isStaff: true,
        staffRoles: { some: { role: { permissions: { some: { permission: { code: PermissionCode.DisputeView } } } } } },
      },
      select: { id: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'staff-1',
          title: 'Новое обращение в поддержку',
          eventName: 'SupportTicketCreated',
          metadata: { ticketId: 'ticket-1', userId: 'client-1', href: '/support?ticketId=ticket-1' },
        }),
        expect.objectContaining({
          userId: 'staff-2',
          title: 'Новое обращение в поддержку',
          eventName: 'SupportTicketCreated',
          metadata: { ticketId: 'ticket-1', userId: 'client-1', href: '/support?ticketId=ticket-1' },
        }),
      ],
    });
  });

  it('ответ клиента отправляет уведомление назначенному staff', async () => {
    prisma.supportTicket.findUnique
      .mockResolvedValueOnce({ id: 'ticket-1', userId: 'client-1', subject: 'Payment issue', assignedToId: 'staff-1' })
      .mockResolvedValueOnce({
        id: 'ticket-1',
        userId: 'client-1',
        subject: 'Payment issue',
        assignedToId: 'staff-1',
        user: { email: 'client@test.dev', profile: { displayName: 'Client Name' } },
        assignedTo: { id: 'staff-1' },
      });
    prisma.supportMessage.create.mockResolvedValue({ id: 'msg-1', ticketId: 'ticket-1', senderId: 'client-1' });
    prisma.supportTicket.update.mockResolvedValue({ id: 'ticket-1' });
    prisma.notification.createMany.mockResolvedValue({ count: 1 });

    await service.addMessage('ticket-1', 'client-1', false, 'New answer');

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'staff-1',
          title: 'Клиент ответил в поддержку',
          eventName: 'SupportUserMessageCreated',
          metadata: { ticketId: 'ticket-1', userId: 'client-1', href: '/support?ticketId=ticket-1' },
        }),
      ],
    });
  });

  it('ответ staff отправляет уведомление владельцу обращения', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 'ticket-1', userId: 'client-1', subject: 'Payment issue' });
    prisma.supportMessage.create.mockResolvedValue({ id: 'msg-1', ticketId: 'ticket-1', senderId: 'staff-1' });
    prisma.supportTicket.update.mockResolvedValue({ id: 'ticket-1' });
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' });

    await service.addMessage('ticket-1', 'staff-1', true, 'Staff answer');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'client-1',
        title: 'Поддержка ответила',
        message: 'По обращению "Payment issue" появился новый ответ.',
        eventName: 'SupportMessageCreated',
        metadata: { ticketId: 'ticket-1', href: '/support?ticketId=ticket-1' },
      },
    });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PermissionCode } from '@taskhunt/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        priority: (dto.priority as any) ?? 'NORMAL',
        messages: { create: { senderId: userId, body: dto.message } },
      },
      include: { messages: true },
    });
    await this.notifySupportStaff(ticket.id, userId, 'SupportTicketCreated');
    return ticket;
  }

  async listMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Для staff (Support/Owner permissions) — очередь всех тикетов. */
  async listAllTickets(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { user: { include: { profile: true } }, assignedTo: { include: { profile: true } } },
    });
  }

  private async assertParticipant(ticketId: string, userId: string, isStaff: boolean) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!isStaff && ticket.userId !== userId) throw new ForbiddenException('Not your ticket');
    return ticket;
  }

  /** Тикет с полным треском сообщений — владельцу или staff. */
  async getTicket(ticketId: string, userId: string, isStaff: boolean) {
    await this.assertParticipant(ticketId, userId, isStaff);
    return this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, include: { sender: { include: { profile: true } } } },
        assignedTo: { include: { profile: true } },
      },
    });
  }

  async addMessage(ticketId: string, senderId: string, isStaff: boolean, body: string, fileId?: string) {
    const ticket = await this.assertParticipant(ticketId, senderId, isStaff);
    const message = await this.prisma.supportMessage.create({
      data: { ticketId, senderId, body, fileId },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: isStaff ? 'PENDING' : 'OPEN', updatedAt: new Date() },
    });
    if (isStaff && ticket.userId !== senderId) {
      await this.prisma.notification.create({
        data: {
          userId: ticket.userId,
          title: 'Поддержка ответила',
          message: `По обращению "${ticket.subject}" появился новый ответ.`,
          eventName: 'SupportMessageCreated',
          metadata: {
            ticketId,
            href: `/support?ticketId=${ticketId}`,
          },
        },
      });
    } else if (!isStaff) {
      await this.notifySupportStaff(ticketId, senderId, 'SupportUserMessageCreated');
    }
    return message;
  }

  async assign(ticketId: string, staffId: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: staffId, status: 'PENDING' },
    });
  }

  async updateStatus(ticketId: string, status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') {
    const updated = await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await this.prisma.notification.create({
      data: {
        userId: updated.userId,
        title: status === 'RESOLVED' || status === 'CLOSED' ? 'Обращение закрывается' : 'Статус поддержки изменён',
        message: `Обращение "${updated.subject}" теперь в статусе ${status}.`,
        eventName: 'SupportTicketStatusChanged',
        metadata: {
          ticketId,
          status,
          href: `/support?ticketId=${ticketId}`,
        },
      },
    });
    return updated;
  }

  private async notifySupportStaff(ticketId: string, actorId: string, eventName: 'SupportTicketCreated' | 'SupportUserMessageCreated') {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { user: { include: { profile: true } }, assignedTo: { include: { profile: true } } },
      });
      if (!ticket) return;

      const recipients = ticket.assignedToId
        ? [{ id: ticket.assignedToId }]
        : await this.prisma.user.findMany({
            where: {
              isStaff: true,
              staffRoles: { some: { role: { permissions: { some: { permission: { code: PermissionCode.DisputeView } } } } } },
            },
            select: { id: true },
          });
      const recipientIds = [...new Set(recipients.map((recipient) => recipient.id).filter((id) => id !== actorId))];
      if (recipientIds.length === 0) {
        this.logger.warn(`Support ticket ${ticketId} has no available staff recipient for ${eventName}`);
        return;
      }

      const userName = ticket.user.profile?.displayName ?? ticket.user.email;
      const title = eventName === 'SupportTicketCreated' ? 'Новое обращение в поддержку' : 'Клиент ответил в поддержку';
      const message =
        eventName === 'SupportTicketCreated'
          ? `${userName} создал обращение "${ticket.subject}".`
          : `${userName} написал новое сообщение в обращении "${ticket.subject}".`;

      await this.prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          title,
          message,
          eventName,
          metadata: {
            ticketId,
            userId: ticket.userId,
            href: `/support?ticketId=${ticketId}`,
          },
        })),
      });
    } catch (err) {
      this.logger.error(`Failed to notify support staff about ticket ${ticketId}: ${err}`);
    }
  }
}

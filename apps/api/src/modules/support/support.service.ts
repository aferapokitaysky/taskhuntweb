import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        priority: (dto.priority as any) ?? 'NORMAL',
        messages: { create: { senderId: userId, body: dto.message } },
      },
      include: { messages: true },
    });
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

  async addMessage(ticketId: string, senderId: string, isStaff: boolean, body: string, fileId?: string) {
    await this.assertParticipant(ticketId, senderId, isStaff);
    const message = await this.prisma.supportMessage.create({
      data: { ticketId, senderId, body, fileId },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: isStaff ? 'PENDING' : 'OPEN', updatedAt: new Date() },
    });
    return message;
  }

  async assign(ticketId: string, staffId: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: staffId, status: 'PENDING' },
    });
  }

  async updateStatus(ticketId: string, status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') {
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private async getThreadAndAssertParticipant(orderId: string, userId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { orderId },
      include: { order: { include: { bids: { where: { status: 'ACCEPTED' } } } } },
    });
    if (!thread) throw new NotFoundException('Chat thread not found — order has no accepted bid yet');

    const isClient = thread.order.clientId === userId;
    const isFreelancer = thread.order.bids.some((b) => b.freelancerId === userId);
    if (!isClient && !isFreelancer) {
      throw new ForbiddenException('Not a participant of this order chat');
    }
    return thread;
  }

  async listMessages(orderId: string, userId: string) {
    const thread = await this.getThreadAndAssertParticipant(orderId, userId);
    return this.prisma.chatMessage.findMany({
      where: { threadId: thread.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { sender: { include: { profile: true } }, invoice: true, file: true },
    });
  }

  async sendTextMessage(orderId: string, senderId: string, body: string) {
    const thread = await this.getThreadAndAssertParticipant(orderId, senderId);
    return this.prisma.chatMessage.create({
      data: { threadId: thread.id, senderId, type: 'TEXT', body },
    });
  }

  async sendFileMessage(orderId: string, senderId: string, fileId: string, body?: string) {
    const thread = await this.getThreadAndAssertParticipant(orderId, senderId);
    return this.prisma.chatMessage.create({
      data: { threadId: thread.id, senderId, type: 'FILE', fileId, body },
    });
  }

  async softDeleteMessage(messageId: string, requesterId: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== requesterId) throw new ForbiddenException('Not your message');
    return this.prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  }

  /**
   * Вызывается ChatEventsListener в ответ на InvoiceIssued — счёт,
   * выставленный фрилансером, появляется в чате как отдельная карточка.
   */
  async createInvoiceMessage(orderId: string, freelancerId: string, invoiceId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { orderId } });
    if (!thread) return; // заказ мог быть создан без чата — не должно происходить, но не валим event listener
    return this.prisma.chatMessage.create({
      data: { threadId: thread.id, senderId: freelancerId, type: 'INVOICE', invoiceId },
    });
  }
}

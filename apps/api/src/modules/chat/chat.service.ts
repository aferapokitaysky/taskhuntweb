import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Тред один на пару (заказ, фрилансер), а не один на заказ — заказчик
   * может писать любому откликнувшемуся до принятия отклика. Тред
   * создаётся лениво при первом обращении: клиент открывает переписку с
   * конкретным фрилансером, у которого есть отклик на заказ, либо сам
   * фрилансер открывает переписку по своему отклику.
   */
  private async getOrCreateThread(orderId: string, freelancerId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { freelancerId } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isClient = order.clientId === userId;
    const isFreelancer = freelancerId === userId;
    if (!isClient && !isFreelancer) {
      throw new ForbiddenException('Not a participant of this order chat');
    }

    const hasBid = order.bids.some((b) => b.status === 'PENDING' || b.status === 'ACCEPTED');
    if (!hasBid) {
      throw new ForbiddenException('This freelancer has no active bid on the order');
    }

    return this.prisma.chatThread.upsert({
      where: { orderId_freelancerId: { orderId, freelancerId } },
      create: { orderId, freelancerId },
      update: {},
    });
  }

  /** Список тредов заказа, видимых текущему юзеру. */
  async listThreads(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: { in: ['PENDING', 'ACCEPTED'] } }, include: { freelancer: { include: { profile: true } } } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isClient = order.clientId === userId;
    if (!isClient && !order.bids.some((b) => b.freelancerId === userId)) {
      throw new ForbiddenException('Not a participant of this order');
    }

    const existingThreads = await this.prisma.chatThread.findMany({
      where: { orderId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        freelancer: { include: { profile: true } },
      },
    });
    const threadByFreelancer = new Map(existingThreads.map((t) => [t.freelancerId, t]));

    if (!isClient) {
      const own = threadByFreelancer.get(userId);
      return own
        ? [{ freelancerId: userId, threadId: own.id, freelancer: own.freelancer, lastMessage: own.messages[0] ?? null, hasThread: true }]
        : [];
    }

    // Клиент видит всех активных откликнувшихся — и тех, с кем уже есть переписка, и тех, кому ещё можно написать первым.
    return order.bids.map((bid) => {
      const thread = threadByFreelancer.get(bid.freelancerId);
      return {
        freelancerId: bid.freelancerId,
        threadId: thread?.id ?? null,
        freelancer: thread?.freelancer ?? bid.freelancer,
        lastMessage: thread?.messages[0] ?? null,
        hasThread: Boolean(thread),
      };
    });
  }

  async listMessages(orderId: string, freelancerId: string, userId: string) {
    const thread = await this.getOrCreateThread(orderId, freelancerId, userId);
    return this.prisma.chatMessage.findMany({
      where: { threadId: thread.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { sender: { include: { profile: true } }, invoice: true, file: true },
    });
  }

  async sendTextMessage(orderId: string, freelancerId: string, senderId: string, body: string) {
    const thread = await this.getOrCreateThread(orderId, freelancerId, senderId);
    return this.prisma.chatMessage.create({
      data: { threadId: thread.id, senderId, type: 'TEXT', body },
    });
  }

  async sendFileMessage(orderId: string, freelancerId: string, senderId: string, fileId: string, body?: string) {
    const thread = await this.getOrCreateThread(orderId, freelancerId, senderId);
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
   * выставленный фрилансером, появляется в его треде с заказчиком.
   */
  async createInvoiceMessage(orderId: string, freelancerId: string, invoiceId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { orderId_freelancerId: { orderId, freelancerId } } });
    if (!thread) return; // теоретически не должно происходить — инвойс шлёт только тот, у кого уже есть тред
    return this.prisma.chatMessage.create({
      data: { threadId: thread.id, senderId: freelancerId, type: 'INVOICE', invoiceId },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventName, InvoiceIssuedEvent, InvoicePaidEvent } from '@taskhunt/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat.service';
import { ChatGateway } from '../chat.gateway';

/**
 * Слушает доменные события через локальный EventEmitter2 (см. EventBusService) —
 * chat-модуль не импортирует WalletModule напрямую, только реагирует на событие.
 * Это и есть развязка между модулями монолита, которая упоминалась в ARCHITECTURE.md.
 */
@Injectable()
export class ChatEventsListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @OnEvent(DomainEventName.InvoiceIssued)
  async onInvoiceIssued(event: InvoiceIssuedEvent) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: event.payload.invoiceId } });
    if (!invoice) return;

    const message = await this.chatService.createInvoiceMessage(
      event.payload.orderId,
      invoice.issuedById,
      invoice.id,
    );
    if (!message) return;

    this.chatGateway.broadcastToOrder(event.payload.orderId, invoice.issuedById, 'newMessage', message);
  }

  /**
   * Раньше статус счёта (PENDING → PAID) в открытом чате обновлялся только
   * поллингом раз в 15с (см. web /chats). Теперь как только IPN подтвердит
   * оплату — толкаем обновлённый счёт напрямую в комнату.
   */
  @OnEvent(DomainEventName.InvoicePaid)
  async onInvoicePaid(event: InvoicePaidEvent) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: event.payload.invoiceId } });
    if (!invoice) return;

    const room = await this.chatService.findThreadRoomForInvoice(invoice.id);
    if (!room) return;

    this.chatGateway.broadcastToOrder(room.orderId, room.freelancerId, 'invoiceUpdated', invoice);
  }
}

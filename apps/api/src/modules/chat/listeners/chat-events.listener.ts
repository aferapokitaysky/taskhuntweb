import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventName, InvoiceIssuedEvent } from '@taskhunt/shared-types';
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

    this.chatGateway.broadcastToOrder(event.payload.orderId, 'newMessage', message);
  }
}

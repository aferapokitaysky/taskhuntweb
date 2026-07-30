import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NowPaymentsService } from './nowpayments.service';
import { WalletService } from './wallet.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { escapeCsvCell } from '../../common/utils/csv';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nowPayments: NowPaymentsService,
    private readonly wallet: WalletService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Фрилансер выставляет счёт прямо в чате заказа. */
  async issueInvoice(freelancerId: string, dto: CreateInvoiceDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { client: { include: { wallet: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const invoice = await this.prisma.invoice.create({
      data: {
        orderId: dto.orderId,
        milestoneId: dto.milestoneId,
        issuedById: freelancerId,
        payerId: order.clientId,
        amount: dto.amount,
        currency: order.currency,
        description: dto.description,
        status: 'PENDING',
      },
    });

    const payment = await this.nowPayments.createPayment({
      priceAmount: dto.amount,
      priceCurrency: order.currency,
      payCurrency: 'usdttrc20',
      orderId: invoice.id,
      ipnCallbackUrl: `${process.env.API_PUBLIC_URL}/wallet/nowpayments/ipn`,
    });

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { nowPaymentsPaymentId: payment.paymentId },
    });

    await this.eventBus.publish(DomainEventName.InvoiceIssued, {
      invoiceId: invoice.id,
      orderId: order.id,
      payerId: order.clientId,
      amount: Number(invoice.amount),
      currency: invoice.currency,
    });

    return { invoice: updated, payment };
  }

  /** Вызывается из NowPaymentsController после проверки подписи IPN. */
  async markPaidAndLockEscrow(nowPaymentsPaymentId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { nowPaymentsPaymentId },
      include: { order: { include: { client: { include: { wallet: true } } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found for this payment id');
    if (invoice.status === 'PAID') return invoice; // идемпотентность на случай повторного IPN

    if (!invoice.order.client.wallet) {
      throw new BadRequestException('Client wallet missing');
    }

    const paid = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.eventBus.publish(DomainEventName.InvoicePaid, {
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      payerId: invoice.payerId,
      freelancerId: invoice.issuedById,
      amount: Number(invoice.amount),
      currency: invoice.currency,
    });

    await this.wallet.lockEscrowForInvoice({
      clientWalletId: invoice.order.client.wallet.id,
      clientId: invoice.order.clientId,
      amount: Number(invoice.amount),
      invoiceId: invoice.id,
      orderId: invoice.orderId,
    });

    return paid;
  }

  async exportOrderInvoicesCsv(userId: string, orderId: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const acceptedFreelancerId = order.bids[0]?.freelancerId;
    if (order.clientId !== userId && acceptedFreelancerId !== userId) {
      throw new ForbiddenException('Not a participant of this order');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { orderId },
      include: { milestone: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'Date,Amount,Currency,Status,Milestone\n';
    const rows = invoices.map((inv) => {
      const date = inv.createdAt.toISOString();
      const amount = inv.amount.toString();
      const currency = inv.currency;
      const status = inv.status;
      const milestone = escapeCsvCell(inv.milestone?.title ?? '—');
      return `${date},${amount},${currency},${status},${milestone}`;
    });

    return header + rows.join('\n');
  }
}

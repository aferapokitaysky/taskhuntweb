import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { NowPaymentsService } from './nowpayments.service';
import { WalletService } from './wallet.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { escapeCsvCell } from '../../common/utils/csv';

const ASSETS_DIR = path.join(__dirname, '../../../assets');
const FONT_REGULAR = path.join(ASSETS_DIR, 'fonts/PTSans-Regular.ttf');
const FONT_BOLD = path.join(ASSETS_DIR, 'fonts/PTSans-Bold.ttf');
const FONT_SERIF_BOLD = path.join(ASSETS_DIR, 'fonts/PTSerif-Bold.ttf');
const LOGO_PATH = path.join(ASSETS_DIR, 'images/logo-full.png');
const BRAND_TERRACOTTA = '#CC785C';
const BRAND_INK = '#1c1917';
const BRAND_MUTED = '#78716c';
const BRAND_SAND = '#F7F4EE';
const BRAND_CREDIT = '#059669';

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
      data: {
        nowPaymentsPaymentId: payment.paymentId,
        payAddress: payment.payAddress,
        payAmount: payment.payAmount,
        payCurrency: payment.payCurrency,
      },
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

  async getPaymentDetails(userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { order: { include: { bids: { where: { status: 'ACCEPTED' } } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const acceptedFreelancerId = invoice.order.bids[0]?.freelancerId;
    const isParticipant =
      invoice.payerId === userId ||
      invoice.issuedById === userId ||
      invoice.order.clientId === userId ||
      acceptedFreelancerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant of this invoice');
    }

    return {
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      payAddress: invoice.payAddress,
      payAmount: invoice.payAmount,
      payCurrency: invoice.payCurrency,
      paymentNetwork: invoice.payCurrency,
    };
  }

  async generateInvoiceReceiptPdf(userId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        milestone: true,
        order: { include: { bids: { where: { status: 'ACCEPTED' } } } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const acceptedFreelancerId = invoice.order.bids[0]?.freelancerId;
    const isParticipant =
      invoice.payerId === userId ||
      invoice.issuedById === userId ||
      invoice.order.clientId === userId ||
      acceptedFreelancerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant of this invoice');
    }
    const [issuedBy, payer] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: invoice.issuedById }, include: { profile: true } }),
      this.prisma.user.findUnique({ where: { id: invoice.payerId }, include: { profile: true } }),
    ]);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.registerFont('Sans', FONT_REGULAR);
    doc.registerFont('Sans-Bold', FONT_BOLD);
    doc.registerFont('Serif-Bold', FONT_SERIF_BOLD);

    const pageWidth = doc.page.width;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const paid = invoice.status === 'PAID';
    const documentTitle = paid ? 'Чек оплаты TaskHunt' : 'Счёт TaskHunt';
    const issuedByName = issuedBy?.profile?.displayName ?? issuedBy?.email ?? invoice.issuedById;
    const payerName = payer?.profile?.displayName ?? payer?.email ?? invoice.payerId;
    const shortId = invoice.id.slice(0, 8).toUpperCase();

    doc.rect(0, 0, pageWidth, 8).fill(BRAND_TERRACOTTA);
    doc.image(LOGO_PATH, margin, 40, { width: 130 });

    doc.font('Serif-Bold').fontSize(22).fillColor(BRAND_INK).text(documentTitle, margin, 102);
    doc
      .font('Sans')
      .fontSize(10)
      .fillColor(BRAND_MUTED)
      .text(`Документ TH-${shortId} · сформирован ${new Date().toLocaleString('ru-RU')}`, margin, 130);

    const cardTop = 168;
    doc.roundedRect(margin, cardTop, contentWidth, 112, 14).fill(BRAND_SAND);
    doc.font('Sans').fontSize(10).fillColor(BRAND_MUTED).text(paid ? 'Оплачено, эскроу открыт' : 'Ожидает оплату', margin + 24, cardTop + 22);
    doc
      .font('Sans-Bold')
      .fontSize(34)
      .fillColor(paid ? BRAND_CREDIT : BRAND_INK)
      .text(`${invoice.amount.toString()} ${invoice.currency}`, margin + 24, cardTop + 40, { width: contentWidth - 48 });
    doc.font('Sans').fontSize(10).fillColor(BRAND_MUTED).text(invoice.order.title, margin + 24, cardTop + 84, { width: contentWidth - 48 });

    let y = cardTop + 150;
    const rowLabelX = margin;
    const rowValueX = margin + 165;
    const row = (label: string, value: string) => {
      doc.font('Sans').fontSize(11).fillColor(BRAND_MUTED).text(label, rowLabelX, y, { width: 150 });
      doc.font('Sans-Bold').fontSize(11).fillColor(BRAND_INK).text(value, rowValueX, y, { width: contentWidth - 165 });
      y += 28;
    };

    row('Статус', invoice.status);
    row('Дата счёта', invoice.createdAt.toLocaleString('ru-RU'));
    if (invoice.paidAt) row('Дата оплаты', invoice.paidAt.toLocaleString('ru-RU'));
    row('Заказчик', payerName);
    row('Исполнитель', issuedByName);
    if (invoice.milestone?.title) row('Этап', invoice.milestone.title);
    if (invoice.description) row('Описание', invoice.description);
    if (invoice.payAmount || invoice.payCurrency) row('К оплате', `${invoice.payAmount?.toString() ?? invoice.amount.toString()} ${invoice.payCurrency ?? invoice.currency}`);
    if (invoice.payAddress) row('Адрес оплаты', invoice.payAddress);
    row('Invoice ID', invoice.id);

    doc.moveTo(margin, y + 10).lineTo(pageWidth - margin, y + 10).strokeColor('#E7E0D3').stroke();
    doc
      .font('Sans')
      .fontSize(9)
      .fillColor(BRAND_MUTED)
      .text('Этот документ подтверждает событие внутри TaskHunt и не является налоговым или бухгалтерским отчётом.', margin, y + 26, {
        width: contentWidth,
      });
    doc.text('TaskHunt — фриланс-биржа со встроенным крипто-эскроу.', margin, y + 40, { width: contentWidth });

    doc.end();
    return done;
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
    await this.ensureOrderInvoiceAccess(userId, orderId);

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

  async listOrderInvoices(userId: string, orderId: string) {
    await this.ensureOrderInvoiceAccess(userId, orderId);

    return this.prisma.invoice.findMany({
      where: { orderId },
      include: { milestone: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensureOrderInvoiceAccess(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const acceptedFreelancerId = order.bids[0]?.freelancerId;
    if (order.clientId !== userId && acceptedFreelancerId !== userId) {
      throw new ForbiddenException('Not a participant of this order');
    }
  }
}

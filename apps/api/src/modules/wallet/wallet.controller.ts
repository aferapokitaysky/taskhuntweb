import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PAYOUT_NETWORKS } from '@taskhunt/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { WalletService } from './wallet.service';
import { InvoiceService } from './invoice.service';
import { DepositService } from './deposit.service';
import { PayoutAddressesService } from './payout-addresses.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SetAutoWithdrawDto } from './dto/set-auto-withdraw.dto';
import { PAYOUT_QUEUE, PayoutJobData } from './payout.processor';
import { Throttle } from '@nestjs/throttler';

export class WithdrawDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsUUID()
  savedAddressId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  payoutAddress?: string;

  @IsOptional()
  @IsIn(PAYOUT_NETWORKS)
  network?: string;

  @IsOptional()
  @IsBoolean()
  saveAddress?: boolean;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateDepositDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly invoiceService: InvoiceService,
    private readonly depositService: DepositService,
    private readonly payoutAddressesService: PayoutAddressesService,
    @InjectQueue(PAYOUT_QUEUE) private readonly payoutQueue: Queue<PayoutJobData>,
  ) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalances(user.id);
  }

  @Get('withdrawal-fee-info')
  getWithdrawalFeeInfo() {
    return this.walletService.getWithdrawalFeeInfo();
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: AuthenticatedUser, @Query('cursor') cursor?: string) {
    return this.walletService.getTransactionHistory(user.id, cursor);
  }

  @Get('transactions/export.csv')
  async exportTransactionsCsv(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const csv = await this.walletService.exportTransactionHistoryCsv(user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  }

  @Get('transactions/:entryId/receipt.pdf')
  async getReceiptPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId') entryId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.walletService.generateReceiptPdf(user.id, entryId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${entryId}.pdf"`);
    res.send(pdf);
  }

  @Patch('auto-withdraw')
  setAutoWithdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetAutoWithdrawDto) {
    return this.walletService.setAutoWithdraw(user.id, dto.threshold, dto.savedAddressId);
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: WithdrawDto) {
    if (!dto.savedAddressId && !dto.payoutAddress) {
      throw new BadRequestException('Укажите savedAddressId или payoutAddress');
    }

    let payoutAddress: string;
    if (dto.savedAddressId) {
      const saved = await this.payoutAddressesService.useForWithdrawal(user.id, dto.savedAddressId);
      payoutAddress = saved.address;
    } else {
      payoutAddress = dto.payoutAddress!;
      if (dto.saveAddress) {
        await this.payoutAddressesService
          .create(user.id, { label: dto.label || dto.network || payoutAddress, network: dto.network ?? 'ERC20', address: payoutAddress })
          .catch(() => undefined);
      }
    }

    const { transaction, amount, fee, netAmount } = await this.walletService.requestWithdrawal(
      user.id,
      dto.amount,
    );

    await this.payoutQueue.add('payout', {
      ledgerTransactionId: transaction.id,
      userId: user.id,
      amount,
      netAmount,
      payoutAddress,
    });

    return { transaction, fee, netAmount, payoutQueued: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('deposits')
  createDeposit(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepositDto) {
    return this.depositService.createDeposit(user.id, dto.amount);
  }

  @Get('deposits/:id/payment')
  getDepositPaymentDetails(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.depositService.getPaymentDetails(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('invoices')
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.issueInvoice(user.id, dto);
  }

  @Get('invoices/:id/payment')
  getInvoicePaymentDetails(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoiceService.getPaymentDetails(user.id, id);
  }

  @Get('invoices/:id/receipt.pdf')
  async getInvoiceReceiptPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.invoiceService.generateInvoiceReceiptPdf(user.id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdf);
  }
}

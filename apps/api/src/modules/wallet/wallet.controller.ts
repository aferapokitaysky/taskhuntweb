import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { WalletService } from './wallet.service';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PAYOUT_QUEUE, PayoutJobData } from './payout.processor';
import { Throttle } from '@nestjs/throttler';

export class WithdrawDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  payoutAddress!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly invoiceService: InvoiceService,
    @InjectQueue(PAYOUT_QUEUE) private readonly payoutQueue: Queue<PayoutJobData>,
  ) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalances(user.id);
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: WithdrawDto) {
    const { transaction, amount, fee, netAmount } = await this.walletService.requestWithdrawal(
      user.id,
      dto.amount,
    );

    await this.payoutQueue.add('payout', {
      ledgerTransactionId: transaction.id,
      userId: user.id,
      amount,
      netAmount,
      payoutAddress: dto.payoutAddress,
    });

    return { transaction, fee, netAmount, payoutQueued: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('invoices')
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.issueInvoice(user.id, dto);
  }
}

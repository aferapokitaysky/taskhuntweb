import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PAYOUT_NETWORKS } from '@taskhunt/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { WalletService } from './wallet.service';
import { InvoiceService } from './invoice.service';
import { PayoutAddressesService } from './payout-addresses.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PAYOUT_QUEUE, PayoutJobData } from './payout.processor';
import { Throttle } from '@nestjs/throttler';

export class WithdrawDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  /** Выбор сохранённого адреса — если задан, `payoutAddress`/`network` не нужны. */
  @IsOptional()
  @IsUUID()
  savedAddressId?: string;

  /** Новый адрес, если не пользуемся книгой адресов. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  payoutAddress?: string;

  @IsOptional()
  @IsIn(PAYOUT_NETWORKS)
  network?: string;

  /** Сохранить `payoutAddress` в книгу адресов на будущее. */
  @IsOptional()
  @IsBoolean()
  saveAddress?: boolean;

  @IsOptional()
  @IsString()
  label?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly invoiceService: InvoiceService,
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
        // Сохраняем до постановки в очередь — адрес должен остаться в
        // книге даже если сама выплата зафейлится и деньги вернутся рефандом,
        // это два независимых события.
        await this.payoutAddressesService
          .create(user.id, { label: dto.label || dto.network || payoutAddress, network: dto.network ?? 'ERC20', address: payoutAddress })
          .catch(() => undefined); // дубль адреса — не блокируем сам вывод из-за ConflictException
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
  @Post('invoices')
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.issueInvoice(user.id, dto);
  }
}

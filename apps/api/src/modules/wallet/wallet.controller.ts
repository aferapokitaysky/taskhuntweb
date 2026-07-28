import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsPositive } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { WalletService } from './wallet.service';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

class WithdrawDto {
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
  ) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalances(user.id);
  }

  @Post('withdraw')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: WithdrawDto) {
    return this.walletService.requestWithdrawal(user.id, dto.amount);
  }

  @Post('invoices')
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.issueInvoice(user.id, dto);
  }
}

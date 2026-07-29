import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { FraudModule } from '../fraud/fraud.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [WalletModule, FraudModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [WalletModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

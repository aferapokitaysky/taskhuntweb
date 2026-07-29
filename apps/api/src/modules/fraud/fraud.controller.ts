import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { FraudService } from './fraud.service';
import { CreateFraudFlagDto } from './dto/create-fraud-flag.dto';

/** Внутренний эндпоинт, вызывается только fraud-service. Не для браузера/фронта. */
@UseGuards(InternalSecretGuard)
@Controller('internal/fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Post('flags')
  receiveFlag(@Body() dto: CreateFraudFlagDto) {
    return this.fraudService.createFlag(dto);
  }
}

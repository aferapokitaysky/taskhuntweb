import { IsInt, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CreateBidDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsInt()
  @Min(1)
  deliveryDays!: number;

  @IsString()
  message!: string;
}

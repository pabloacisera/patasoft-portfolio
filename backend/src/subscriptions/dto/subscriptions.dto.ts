import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionPlanDto {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreateSubscriptionCheckoutDto {
  @ApiProperty({ enum: SubscriptionPlanDto })
  @IsEnum(SubscriptionPlanDto)
  plan: SubscriptionPlanDto;
}

export class SubscriptionWebhookDto {
  @IsString()
  action: string;
  
  @IsOptional()
  data: any;
}

import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePreferenceDto {
  @IsNumber() paymentId: number;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() unitPrice?: number;
  @IsNumber() @IsOptional() quantity?: number;
}

export class QrPaymentDto {
  @IsNumber() paymentId: number;
  @IsNumber() amount: number;
  @IsString() @IsOptional() description?: string;
}

export class WebhookDto {
  @IsString() type: string;
  @IsString() action: string;
  @IsOptional() data?: { id: string };
}
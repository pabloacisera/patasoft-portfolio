import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePreferenceDto {
  @IsString() paymentId: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() unitPrice?: number;
  @IsNumber() @IsOptional() quantity?: number;
}

export class QrPaymentDto {
  @IsString() paymentId: string;
  @IsNumber() amount: number;
  @IsString() @IsOptional() description?: string;
}

export class WebhookDto {
  @IsString() type: string;
  @IsString() action: string;
  @IsOptional() data?: { id: string };
}
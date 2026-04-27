import { IsString, IsOptional, IsNumber, IsUUID, IsEnum, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID() clientId?: string;
  @IsUUID() petId?: string;
  @IsUUID() medicalRecordId?: string;
  @IsNumber() totalAmount: number;
  @IsEnum(['PENDING', 'PARTIAL', 'PAID', 'DEFERRED', 'CANCELLED', 'OVERDUE']) status?: string;
  @IsEnum(['CASH', 'TRANSFER', 'MP_QR', 'MP_CHECKOUT', 'CHECK', 'OTHER']) method?: string;
  @IsDateString() dueDate?: string;
  @IsString() notes?: string;
  items?: { description: string; quantity: number; unitPrice: number; totalPrice: number; itemType: string }[];
}

export class UpdatePaymentDto {
  @IsOptional() @IsEnum(['PENDING', 'PARTIAL', 'PAID', 'DEFERRED', 'CANCELLED', 'OVERDUE']) status?: string;
  @IsOptional() @IsNumber() paidAmount?: number;
  @IsOptional() @IsDateString() paidAt?: string;
}
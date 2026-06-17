import { IsString, IsOptional, IsNumber, IsInt, IsEnum, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt() clientId?: number;
  @IsInt() petId?: number;
  @IsInt() medicalRecordId?: number;
  @IsNumber() totalAmount: number;
  @IsEnum(['PENDING', 'PARTIAL', 'PAID', 'DEFERRED', 'CANCELLED', 'OVERDUE']) status?: string;
  @IsEnum(['CASH', 'TRANSFER', 'MP_QR', 'MP_CHECKOUT', 'CHECK', 'OTHER']) method?: string;
  @IsDateString() dueDate?: string;
  @IsString() notes?: string;
  @IsOptional() @IsNumber() interestRate?: number; // % mensual
  items?: { description: string; quantity: number; unitPrice: number; totalPrice: number; itemType?: string; supplyId?: number }[];
}

export class UpdatePaymentDto {
  @IsOptional() @IsEnum(['PENDING', 'PARTIAL', 'PAID', 'DEFERRED', 'CANCELLED', 'OVERDUE']) status?: string;
  @IsOptional() @IsEnum(['CASH', 'TRANSFER', 'MP_QR', 'MP_CHECKOUT', 'CHECK', 'OTHER']) method?: string;
  @IsOptional() @IsNumber() paidAmount?: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsNumber() interestRate?: number;
}
import { IsString, IsOptional, IsBoolean, IsEnum, IsNumber } from 'class-validator';

export class CreateNotificationDto {
  @IsString() userId?: string;
  @IsString() title: string;
  @IsString() message: string;
  @IsEnum(['STOCK_LOW', 'DEBT_DUE', 'DEBT_OVERDUE', 'CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'CONNECTION_REJECTED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'MIGRATION_COMPLETE', 'ONBOARDING_INCOMPLETE', 'DOCUMENT_READY', 'SYSTEM']) type: string;
  @IsOptional() data?: Record<string, any>;
  @IsOptional() expiresAt?: string;
}

export class UpdateNotificationDto {
  @IsBoolean() isRead?: boolean;
}

export class QueryNotificationDto {
  @IsOptional() @IsNumber() page?: number;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() @IsBoolean() unreadOnly?: boolean;
}
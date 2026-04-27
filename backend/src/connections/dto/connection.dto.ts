import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateConnectionDto {
  @IsString() companyBId: string;
}

export class UpdateConnectionDto {
  @IsEnum(['ACCEPTED', 'REJECTED', 'BLOCKED']) status: string;
}

export class QueryConnectionDto {
  @IsOptional() @IsNumber() page?: number;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED']) status?: string;
}
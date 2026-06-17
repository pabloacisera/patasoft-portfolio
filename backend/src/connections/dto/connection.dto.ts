import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateConnectionDto {
  @IsNumber() companyBId: number;
}

export class UpdateConnectionDto {
  @IsEnum(['ACCEPTED', 'REJECTED', 'BLOCKED']) status: string;
}

export class QueryConnectionDto {
  @IsOptional() @IsNumber() page?: number;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED']) status?: string;
}
import { IsString, IsOptional, IsNumber, IsUUID, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ProcedureDto {
  @IsString()
  name: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  priceItemId?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplyId?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  customPrice?: number;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantity?: number;
}

class PrescriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplyId?: string;
  
  @IsString()
  medicineName: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dispensingQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dispensingUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  doseQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doseUnit?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  soldInClinic?: boolean;
}

export class CreateMedicalRecordDto {
  @IsUUID()
  petId: string;

  @IsString()
  visitReason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  veterinarianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureDto)
  procedures?: ProcedureDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDto)
  prescriptions?: PrescriptionDto[];
}

export class UpdateMedicalRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  veterinarianId?: string;
}
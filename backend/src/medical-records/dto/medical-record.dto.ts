import { IsString, IsOptional, IsNumber, IsInt, IsDateString, IsArray, ValidateNested, IsEnum, IsBoolean, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class PetPhotoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  base64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

class ProcedureDto {
  @IsString()
  name: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priceItemId?: number;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  supplyId?: number;
  
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
  @IsInt()
  supplyId?: number;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicineName?: string;
  
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
  @IsBoolean()
  soldInClinic?: boolean;
}

class SupplyItemDto {
  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  totalPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  supplyId?: number;
}

export class CreateMedicalRecordDto {
  @IsInt()
  petId: number;

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
  @IsInt()
  veterinarianId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  veterinarianName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PetPhotoDto)
  photos?: PetPhotoDto[];

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyItemDto)
  supplyItems?: SupplyItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['CASH', 'TRANSFER', 'MP_QR', 'MP_CHECKOUT', 'CHECK', 'OTHER'])
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['PENDING', 'PARTIAL', 'PAID', 'DEFERRED'])
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentNotes?: string;
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
  @IsInt()
  veterinarianId?: number;
}
import { IsString, IsOptional, IsArray, IsBoolean, IsUrl, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Veterinaria Mi Mascota' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Mi Mascota SRL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiProperty({ example: '20-12345678-9' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  cuit: string;

  @ApiPropertyOptional({ example: 'LIC-2024-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  municipalLicense?: string;

  @ApiProperty({ example: 'Av. Santa Fe 1234, Buenos Aires' })
  @IsString()
  @MinLength(5)
  address: string;

  @ApiPropertyOptional({ example: '+54 11 1234-5678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@mimascota.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'https://mimascota.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ example: 'https://cloudinary.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: ['dogs', 'cats'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  animalSpecialties?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isGeneral?: boolean;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  animalSpecialties?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGeneral?: boolean;
}

export class UpdateCompanyConfigDto {
  @ApiPropertyOptional({ example: 'ARS' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'llama-3.3-70b-versatile' })
  @IsOptional()
  @IsString()
  defaultAIModel?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsString()
  lowStockDefaultPct?: number;

  @ApiPropertyOptional({ example: [1, 2] })
  @IsOptional()
  @IsArray()
  debtAlertDays?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyInApp?: boolean;
}
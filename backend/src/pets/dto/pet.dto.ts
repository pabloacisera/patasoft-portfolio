import { IsString, IsOptional, IsBoolean, IsNumber, IsInt, Min, Max, IsDateString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePetDto {
  @IsString()
  name: string;

  @IsString()
  species: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  microchipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  species?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  microchipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

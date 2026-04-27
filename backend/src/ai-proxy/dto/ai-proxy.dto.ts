import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  history?: any[];
}

export class TranscribeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  audioUrl: string;
}

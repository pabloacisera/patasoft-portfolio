import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGuestSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class GuestDataDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: 'clients' | 'pets' | 'medical_records' | 'payments' | 'supplies' | 'company';

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  data: any;
}

export class GuestSessionQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

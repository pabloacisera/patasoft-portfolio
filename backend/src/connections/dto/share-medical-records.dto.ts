import { IsNumber, IsArray, IsOptional, IsString } from 'class-validator';

export class ShareMedicalRecordsDto {
  @IsNumber() targetCompanyId: number;
  @IsNumber({}, { each: true }) @IsArray()
  medicalRecordIds: number[];
  @IsOptional() @IsString() notes?: string;
}
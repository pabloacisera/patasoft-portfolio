import { IsString, IsArray, IsOptional } from 'class-validator';

export class ShareMedicalRecordsDto {
  @IsString() targetCompanyId: string;
  @IsArray() medicalRecordIds: string[];
  @IsOptional() @IsString() notes?: string;
}
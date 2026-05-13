import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { PdfService } from '../documents/pdf.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    AiProxyModule,
  ],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService, PdfService],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
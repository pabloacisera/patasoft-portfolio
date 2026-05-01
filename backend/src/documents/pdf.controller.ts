import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('api/v1/pets')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private pdfService: PdfService) {}

  @Get(':id/document')
  async generatePetDocument(
    @Param('id') petId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    // Use generateMedicalHistory for complete medical history
    const pdf = await this.pdfService.generateMedicalHistory(petId, user.companyId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historia-completa-${petId.slice(-6)}.pdf"`,
    });
    
    res.send(pdf);
  }
}
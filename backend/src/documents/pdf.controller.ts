import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('api/v1/pets')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private pdfService: PdfService) {}

  @Get(':id/document')
  async generatePetDocument(
    @Param('id', ParseHashIdPipe) petId: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const pdf = await this.pdfService.generateMedicalHistory(petId, user.companyId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historia-completa-${petId}.pdf"`,
    });
    
    res.send(pdf);
  }
}
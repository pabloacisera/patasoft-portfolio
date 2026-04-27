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
    const pdf = await this.pdfService.generatePetCard(petId, user.companyId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ficha-mascota-${petId}.pdf"`,
    });
    
    res.send(pdf);
  }
}
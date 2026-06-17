import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { MedicalRecordResponseDto, ProcedureResponseDto, PrescriptionResponseDto } from '../common/dto/response.dto';

@ApiTags('medical-records')
@ApiBearerAuth()
@Controller('api/v1/medical-records')
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private medicalRecordsService: MedicalRecordsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [MedicalRecordResponseDto] })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.medicalRecordsService.findAll(user.companyId, query);
  }

  @Post()
  @ApiResponse({ status: 201, type: MedicalRecordResponseDto })
  create(@Body() dto: CreateMedicalRecordDto, @CurrentUser() user: any) {
    return this.medicalRecordsService.create(user.companyId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: MedicalRecordResponseDto })
  update(@Param('id', ParseHashIdPipe) id: number, @Body() dto: UpdateMedicalRecordDto, @CurrentUser() user: any) {
    return this.medicalRecordsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 200 })
  remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.medicalRecordsService.remove(id, user.companyId);
  }

  @Post(':id/procedures')
  @ApiResponse({ status: 201, type: ProcedureResponseDto })
  addProcedure(@Param('id', ParseHashIdPipe) id: number, @Body() dto: any, @CurrentUser() user: any) {
    return this.medicalRecordsService.addProcedure(id, user.companyId, dto);
  }

  @Post(':id/prescriptions')
  @ApiResponse({ status: 201, type: PrescriptionResponseDto })
  addPrescription(@Param('id', ParseHashIdPipe) id: number, @Body() dto: any, @CurrentUser() user: any) {
    return this.medicalRecordsService.addPrescription(id, user.companyId, dto);
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Generates a PDF of the prescription' })
  async getPrescriptionPdf(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any, @Res() res: Response) {
    try {
      await this.medicalRecordsService.findOne(id, user.companyId);
      const pdfBuffer = await this.medicalRecordsService.generateAndStorePrescription(id, user.companyId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=receta_${String(id).padStart(6, '0')}.pdf`,
        'Content-Length': pdfBuffer.byteLength,
      });
      return res.end(pdfBuffer);
    } catch (e) {
      res.status(500).json({ message: 'Error generando PDF de receta. Intente nuevamente.' });
    }
  }

  @Get(':id/prescription/url')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, schema: { properties: { url: { type: 'string' } } } })
  async getPrescriptionUrl(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    try {
      await this.medicalRecordsService.findOne(id, user.companyId);
      const doc = await this.medicalRecordsService.findPrescriptionDocument(id, user.companyId);
      if (!doc) {
        await this.medicalRecordsService.generateAndStorePrescription(id, user.companyId);
        const newDoc = await this.medicalRecordsService.findPrescriptionDocument(id, user.companyId);
        return { url: newDoc?.cloudinaryUrl || null };
      }
      return { url: doc.cloudinaryUrl };
    } catch (e) {
      throw new NotFoundException('No se pudo generar la URL de la receta');
    }
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: MedicalRecordResponseDto })
  findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.medicalRecordsService.findOne(id, user.companyId);
  }

  @Post(':id/cancel')
  @ApiResponse({ status: 200, description: 'Cancela la consulta y restaura stock/caja' })
  cancel(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.medicalRecordsService.cancel(id, user.companyId);
  }

  @Get(':id/receipt/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Genera un PDF del comprobante' })
  async getReceiptPdf(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any, @Res() res: Response) {
    try {
      const record = await this.medicalRecordsService.findOne(id, user.companyId);
      if (!record.payment) {
        throw new NotFoundException('No hay pago asociado a esta consulta');
      }
      const pdfBuffer = await this.medicalRecordsService.generateAndStoreReceipt(record.payment.id, user.companyId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=comprobante_${String(record.payment.id).padStart(6, '0')}.pdf`,
        'Content-Length': pdfBuffer.byteLength,
      });
      return res.end(pdfBuffer);
    } catch (e) {
      res.status(500).json({ message: 'Error generando PDF comprobante. Intente nuevamente.' });
    }
  }
}
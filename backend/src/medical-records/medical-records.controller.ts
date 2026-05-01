import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from '../documents/pdf.service';

@ApiTags('medical-records')
@ApiBearerAuth()
@Controller('api/v1/medical-records')
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private medicalRecordsService: MedicalRecordsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.medicalRecordsService.findAll(user.companyId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.medicalRecordsService.findOne(id, user.companyId);
  }

  @Post()
  create(@Body() dto: CreateMedicalRecordDto, @CurrentUser() user: any) {
    return this.medicalRecordsService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMedicalRecordDto, @CurrentUser() user: any) {
    return this.medicalRecordsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.medicalRecordsService.remove(id, user.companyId);
  }

  @Post(':id/procedures')
  addProcedure(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.medicalRecordsService.addProcedure(id, user.companyId, dto);
  }

  @Post(':id/prescriptions')
  addPrescription(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.medicalRecordsService.addPrescription(id, user.companyId, dto);
  }

  @Get(':id/prescription/url')
  @UseGuards(JwtAuthGuard)
  async getPrescriptionUrl(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.medicalRecordsService.findOne(id, user.companyId);
    if (!record) throw new NotFoundException('Historial no encontrado');

    const doc = await this.medicalRecordsService.findPrescriptionDocument(id, user.companyId);
    if (!doc) {
      await this.medicalRecordsService.generateAndStorePrescription(id, user.companyId);
      const newDoc = await this.medicalRecordsService.findPrescriptionDocument(id, user.companyId);
      return { url: newDoc?.cloudinaryUrl || null };
    }
    return { url: doc.cloudinaryUrl };
  }
}
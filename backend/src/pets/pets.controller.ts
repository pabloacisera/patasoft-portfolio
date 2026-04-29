import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetsService } from './pets.service';
import { PdfService } from '../documents/pdf.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Response } from 'express';

@ApiTags('pets')
@ApiBearerAuth()
@Controller('api/v1/pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(
    private petsService: PetsService,
    private pdfService: PdfService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.petsService.findAll(user.companyId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.petsService.findOne(id, user.companyId);
  }

  @Post()
  create(@Body() dto: CreatePetDto, @CurrentUser() user: any) {
    return this.petsService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePetDto, @CurrentUser() user: any) {
    return this.petsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.petsService.remove(id, user.companyId);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const pet = await this.petsService.findOne(id, user.companyId);
    const folder = `patasoft/pets`;
    return this.petsService.uploadPhoto(id, user.companyId, file.path, folder);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(@Param('id') id: string, @Param('photoId') photoId: string, @CurrentUser() user: any) {
    return this.petsService.deletePhoto(id, photoId, user.companyId);
  }

  @Get(':id/medical-records')
  getMedicalRecords(@Param('id') id: string, @CurrentUser() user: any) {
    return this.petsService.getMedicalRecords(id, user.companyId);
  }

  @Get(':id/medical-history/pdf')
  async getMedicalHistoryPdf(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generateMedicalHistory(id, user.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historial-${id}.pdf"`,
    });
    res.send(pdfBuffer);
  }
}

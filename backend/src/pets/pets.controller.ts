import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetsService } from './pets.service';
import { PdfService } from '../documents/pdf.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { PetResponseDto, MedicalRecordResponseDto } from '../common/dto/response.dto';

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
  @ApiResponse({ status: 200, type: [PetResponseDto] })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.petsService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: PetResponseDto })
  findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.petsService.findOne(id, user.companyId);
  }

  @Post()
  @ApiResponse({ status: 201, type: PetResponseDto })
  create(@Body() dto: CreatePetDto, @CurrentUser() user: any) {
    return this.petsService.create(user.companyId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: PetResponseDto })
  update(@Param('id', ParseHashIdPipe) id: number, @Body() dto: UpdatePetDto, @CurrentUser() user: any) {
    return this.petsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 200 })
  remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.petsService.remove(id, user.companyId);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Solo se permiten imágenes'), false);
      }
      cb(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201 })
  async uploadPhoto(
    @Param('id', ParseHashIdPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió imagen');
    return this.petsService.uploadPhoto(id, user.companyId, file.buffer, file.mimetype);
  }

  @Delete(':id/photos/:photoId')
  @ApiResponse({ status: 200 })
  deletePhoto(@Param('id', ParseHashIdPipe) id: number, @Param('photoId', ParseHashIdPipe) photoId: number, @CurrentUser() user: any) {
    return this.petsService.deletePhoto(id, photoId, user.companyId);
  }

  @Get(':id/medical-records')
  @ApiResponse({ status: 200, type: [MedicalRecordResponseDto] })
  getMedicalRecords(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.petsService.getMedicalRecords(id, user.companyId);
  }

  @Get(':id/medical-history/pdf')
  @ApiResponse({ status: 200, description: 'Generates a PDF of the medical history' })
  async getMedicalHistoryPdf(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generateMedicalHistory(id, user.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historial-${id}.pdf"`,
    });
    res.send(pdfBuffer);
  }
}

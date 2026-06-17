import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SuppliesService } from './supplies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';

@ApiTags('supplies')
@ApiBearerAuth()
@Controller('api/v1/supplies')
@UseGuards(JwtAuthGuard)
export class SuppliesController {
  constructor(private s: SuppliesService) {}
  
  @Get() findAll(@CurrentUser() u: any, @Query() q: any) { return this.s.findAll(u.companyId, q); }
  
  @Get('low-stock') lowStock(@CurrentUser() u: any) { return this.s.getLowStock(u.companyId); }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.s.downloadTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-insumos.xlsx"');
    return res.send(buffer);
  }

  @Get('export')
  async exportExcel(@CurrentUser() u: any, @Res() res: Response) {
    const buffer = await this.s.exportExcel(u.companyId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="insumos-exportados.xlsx"');
    return res.send(buffer);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@CurrentUser() u: any, @UploadedFile() file: Express.Multer.File) {
    return this.s.importFromExcel(u.companyId, file.buffer);
  }

  @Get(':id') findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { return this.s.findOne(id, u.companyId); }
  
  @Post() create(@Body() d: any, @CurrentUser() u: any) { return this.s.create(u.companyId, d); }
  
  @Patch(':id') update(@Param('id', ParseHashIdPipe) id: number, @Body() d: any, @CurrentUser() u: any) { return this.s.update(id, u.companyId, d); }
  
  @Delete(':id') remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { return this.s.remove(id, u.companyId); }

  @Post(':id/decrease')
  decreaseStock(@Param('id', ParseHashIdPipe) id: number, @Body('quantity') qty: number, @CurrentUser() u: any) {
    return this.s.decreaseStock(id, u.companyId, qty);
  }
}
import { 
  Controller, Get, Post, Patch, Delete, Body, Param, 
  UseGuards, Query, UseInterceptors, UploadedFile, Res 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PriceItemsService } from './price-items.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';

@ApiTags('price-items') 
@ApiBearerAuth() 
@Controller('api/v1/price-items') 
@UseGuards(JwtAuthGuard)
export class PriceItemsController {
  constructor(private s: PriceItemsService) {}

  @Get() 
  findAll(@CurrentUser() u: any, @Query() q: any) { 
    return this.s.findAll(u.companyId, q); 
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.s.downloadTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=plantilla_precios.xlsx',
      'Content-Length': buffer.byteLength,
    });
    return res.end(buffer);
  }

  @Get('export')
  exportExcel(@CurrentUser() u: any) {
    return this.s.exportExcel(u.companyId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(@CurrentUser() u: any, @UploadedFile() file: Express.Multer.File) {
    return this.s.importFromExcel(u.companyId, file.buffer);
  }

  @Post() 
  create(@Body() d: any, @CurrentUser() u: any) { 
    return this.s.create(u.companyId, d); 
  }

  @Patch(':id') 
  update(@Param('id', ParseHashIdPipe) id: number, @Body() d: any, @CurrentUser() u: any) { 
    return this.s.update(id, u.companyId, d); 
  }

  @Delete(':id') 
  remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { 
    return this.s.remove(id, u.companyId); 
  }
}

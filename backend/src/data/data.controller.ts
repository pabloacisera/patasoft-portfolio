import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { DataService } from './data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/data')
export class DataController {
  constructor(private dataService: DataService) {}

  @Get('export-all')
  async exportAll(@CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.dataService.exportAll(user.companyId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mis-datos.xlsx"`,
    );
    res.send(buffer);
  }
}

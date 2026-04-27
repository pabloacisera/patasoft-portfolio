import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto, UpdateConnectionDto, QueryConnectionDto } from './dto/connection.dto';
import { ShareMedicalRecordsDto } from './dto/share-medical-records.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('connections')
@ApiBearerAuth()
@Controller('api/v1/connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private connectionsService: ConnectionsService) {}

  @Get() findAll(@CurrentUser() user: any, @Query() q: QueryConnectionDto) {
    return this.connectionsService.findAll(user.companyId, q);
  }

  @Get('all') getConnectedCompanies(@CurrentUser() user: any) {
    return this.connectionsService.getConnectedCompanies(user.companyId);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.connectionsService.findOne(id, user.companyId);
  }

  @Post() create(@Body() dto: CreateConnectionDto, @CurrentUser() user: any) {
    return this.connectionsService.create(user.companyId, dto);
  }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateConnectionDto, @CurrentUser() user: any) {
    return this.connectionsService.update(id, user.companyId, dto);
  }

  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.connectionsService.remove(id, user.companyId);
  }

  @Post('share') shareMedicalRecords(@Body() dto: ShareMedicalRecordsDto, @CurrentUser() user: any) {
    return this.connectionsService.shareMedicalRecords(user.companyId, dto);
  }

  @Get('shared/:fromCompanyId') getSharedMedicalRecords(@Param('fromCompanyId') fromCompanyId: string, @CurrentUser() user: any) {
    return this.connectionsService.getSharedMedicalRecords(user.companyId, fromCompanyId);
  }
}
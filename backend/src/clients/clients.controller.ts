import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('api/v1/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.clientsService.findAll(user.companyId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.findOne(id, user.companyId);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: any) {
    return this.clientsService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: any) {
    return this.clientsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.remove(id, user.companyId);
  }

  @Get(':id/pets')
  getPets(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.getPets(id, user.companyId);
  }

  @Get(':id/payments')
  getPayments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.getPayments(id, user.companyId);
  }

  @Get(':id/debts')
  getDebts(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.getDebts(id, user.companyId);
  }
}
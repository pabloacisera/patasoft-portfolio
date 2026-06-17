import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { ClientResponseDto } from '../common/dto/response.dto';
import { PetResponseDto, PaymentResponseDto, DebtResponseDto } from '../common/dto/response.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('api/v1/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [ClientResponseDto] })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.clientsService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: ClientResponseDto })
  findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.clientsService.findOne(id, user.companyId);
  }

  @Post()
  @ApiResponse({ status: 201, type: ClientResponseDto })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: any) {
    return this.clientsService.create(user.companyId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: ClientResponseDto })
  update(@Param('id', ParseHashIdPipe) id: number, @Body() dto: UpdateClientDto, @CurrentUser() user: any) {
    return this.clientsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 200 })
  remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.clientsService.remove(id, user.companyId);
  }

  @Get(':id/pets')
  @ApiResponse({ status: 200, type: [PetResponseDto] })
  getPets(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.clientsService.getPets(id, user.companyId);
  }

  @Get(':id/payments')
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  getPayments(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.clientsService.getPayments(id, user.companyId);
  }

  @Get(':id/debts')
  @ApiResponse({ status: 200, type: [DebtResponseDto] })
  getDebts(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.clientsService.getDebts(id, user.companyId);
  }
}
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyResponseDto } from '../common/dto/response.dto';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('api/v1/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(
    private companiesService: CompaniesService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiResponse({ status: 200, type: [CompanyResponseDto] })
  findAll(@Query() pagination: any) {
    return this.companiesService.findAll(pagination);
  }

  @Get('me')
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  findMyCompany(@CurrentUser() user: any) {
    return this.companiesService.findMyCompany(user.id);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  findOne(@Param('id', ParseHashIdPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: CompanyResponseDto })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: any) {
    return this.companiesService.create(user.id, dto);
  }

  @Patch('me')
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  update(@Body() dto: UpdateCompanyDto, @CurrentUser() user: any) {
    return this.companiesService.update(user.companyId, user.id, dto);
  }

  @Delete('me')
  @Roles('ADMIN_COMPANY', 'SUPER_ADMIN')
  @ApiResponse({ status: 200 })
  remove(@CurrentUser() user: any) {
    return this.companiesService.delete(user.companyId, user.id);
  }

  @Get('me/config')
  @ApiResponse({ status: 200 })
  async getConfig(@CurrentUser() user: any) {
    const company = await this.companiesService.findMyCompany(user.id);
    if (!company) {
      return { message: 'No tienes una empresa asociada' };
    }
    return this.prisma.companyConfig.findUnique({ where: { companyId: company.id } });
  }

  @Patch('me/config')
  @ApiResponse({ status: 200 })
  async updateConfig(@Body() dto: any, @CurrentUser() user: any) {
    const company = await this.companiesService.findMyCompany(user.id);
    if (!company) {
      return { message: 'No tienes una empresa asociada' };
    }
    return this.prisma.companyConfig.update({
      where: { companyId: company.id },
      data: dto,
    });
  }

  @Get('slug/:slug')
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  findBySlug(@Param('slug') slug: string) {
    return this.companiesService.findBySlug(slug);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: [CompanyResponseDto] })
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.companiesService.search(q, user.companyId);
  }
}
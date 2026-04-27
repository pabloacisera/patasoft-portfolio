import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

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
  findAll(@Query() pagination: any) {
    return this.companiesService.findAll(pagination);
  }

  @Get('me')
  findMyCompany(@CurrentUser() user: any) {
    return this.companiesService.findMyCompany(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: any) {
    return this.companiesService.create(user.id, dto);
  }

  @Patch('me')
  update(@Body() dto: UpdateCompanyDto, @CurrentUser() user: any) {
    return this.companiesService.update(user.companyId, user.id, dto);
  }

  @Delete('me')
  @Roles('ADMIN_COMPANY', 'SUPER_ADMIN')
  remove(@CurrentUser() user: any) {
    return this.companiesService.delete(user.companyId, user.id);
  }

  @Get('me/config')
  async getConfig(@CurrentUser() user: any) {
    const company = await this.companiesService.findMyCompany(user.id);
    if (!company) {
      return { message: 'No tienes una empresa asociada' };
    }
    return this.prisma.companyConfig.findUnique({ where: { companyId: company.id } });
  }

  @Patch('me/config')
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
  findBySlug(@Param('slug') slug: string) {
    return this.companiesService.findBySlug(slug);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.companiesService.search(q, user.companyId);
  }
}
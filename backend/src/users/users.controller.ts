import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserQueryDto } from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN_COMPANY', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Listar todos los usuarios de la empresa' })
  findAll(@CurrentUser() user: any, @Query() query: UserQueryDto) {
    return this.usersService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    // Si no es admin, solo puede verse a sí mismo (esto se podría refinar)
    const companyId = user.role === 'SUPER_ADMIN' ? null : user.companyId;
    return this.usersService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const companyId = user.role === 'SUPER_ADMIN' ? null : user.companyId;
    return this.usersService.update(id, companyId, updateUserDto);
  }

  @Delete(':id')
  @Roles('ADMIN_COMPANY', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Desactivar un usuario' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    const companyId = user.role === 'SUPER_ADMIN' ? null : user.companyId;
    return this.usersService.deactivate(id, companyId);
  }
}

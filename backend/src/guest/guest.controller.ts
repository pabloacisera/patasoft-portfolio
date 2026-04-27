import { Controller, Get, Post, Body, Param, Delete, Query, Patch, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GuestService } from './guest.service';
import { CreateGuestSessionDto, GuestDataDto } from './dto/guest.dto';

@ApiTags('guest')
@Controller('api/v1/guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('session')
  @ApiOperation({ summary: 'Crear o inicializar sesión de invitado' })
  createSession(@Body() dto: CreateGuestSessionDto) {
    return this.guestService.createSession(dto.sessionId);
  }

  @Get('session')
  @ApiOperation({ summary: 'Obtener todos los datos de la sesión de invitado' })
  getSession(@Headers('x-guest-session-id') sessionId: string) {
    if (!sessionId) throw new BadRequestException('Session ID requerido');
    return this.guestService.getSession(sessionId);
  }

  @Post('data')
  @ApiOperation({ summary: 'Agregar datos a la sesión de invitado' })
  addData(
    @Headers('x-guest-session-id') sessionId: string,
    @Body() dto: GuestDataDto
  ) {
    if (!sessionId) throw new BadRequestException('Session ID requerido');
    return this.guestService.addData(sessionId, dto);
  }

  @Patch('data/:type/:id')
  @ApiOperation({ summary: 'Actualizar un item en la sesión de invitado' })
  updateItem(
    @Headers('x-guest-session-id') sessionId: string,
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() data: any
  ) {
    if (!sessionId) throw new BadRequestException('Session ID requerido');
    return this.guestService.updateItem(sessionId, type, id, data);
  }

  @Delete('data/:type/:id')
  @ApiOperation({ summary: 'Eliminar un item de la sesión de invitado' })
  deleteItem(
    @Headers('x-guest-session-id') sessionId: string,
    @Param('type') type: string,
    @Param('id') id: string
  ) {
    if (!sessionId) throw new BadRequestException('Session ID requerido');
    return this.guestService.deleteItem(sessionId, type, id);
  }

  @Delete('session')
  @ApiOperation({ summary: 'Eliminar sesión de invitado completa' })
  deleteSession(@Headers('x-guest-session-id') sessionId: string) {
    if (!sessionId) throw new BadRequestException('Session ID requerido');
    return this.guestService.deleteSession(sessionId);
  }
}

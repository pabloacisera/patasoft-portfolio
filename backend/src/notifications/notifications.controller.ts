import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, UpdateNotificationDto, QueryNotificationDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get() findAll(@CurrentUser() user: any, @Query() q: QueryNotificationDto) {
    return this.notificationsService.findAll(user.companyId, user.id, q);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.findAll(user.companyId, user.id, { unreadOnly: true });
    return { count: count.meta.total };
  }

  @Get(':id') findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.notificationsService.findOne(id, user.companyId);
  }

  @Post() create(@Body() dto: CreateNotificationDto, @CurrentUser() user: any) {
    return this.notificationsService.create(user.companyId, dto);
  }

  @Patch(':id/read') markAsRead(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.notificationsService.markAsRead(id, user.companyId);
  }

  @Patch('read-all') markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.companyId, user.id);
  }

  @Delete(':id') remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() user: any) {
    return this.notificationsService.remove(id, user.companyId);
  }
}
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Get('all')
  findAll() {
    return this.notificationsService.findAll();
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get()
  findMyNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findByUser(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('unread')
  findMyUnreadNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findUnreadByUser(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('unread/count')
  countMyUnreadNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.countUnreadByUser(userId);
  }

  @Roles(Role.ADMIN)
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.notificationsService.findByUser(userId);
  }

  @Roles(Role.ADMIN)
  @Get('user/:userId/unread')
  findUnreadByUser(@Param('userId') userId: string) {
    return this.notificationsService.findUnreadByUser(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch('read-all')
  markMyAllAsRead(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch('delete-selected')
  deleteSelected(
    @Body() dto: { notificationIds: string[] },
    @Request() req: { user: any },
  ) {
    const userId = req.user.id || req.user.sub;

    return this.notificationsService.deleteSelectedForUser(
      userId,
      dto.notificationIds,
    );
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch('delete-all')
  deleteAll(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;

    return this.notificationsService.deleteAllForUser(userId);
  }

  @Roles(Role.ADMIN)
  @Patch('user/:userId/read-all')
  markAllAsRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;

    return this.notificationsService.markAsRead(id, userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch(':id/delete')
  deleteOne(@Param('id') id: string, @Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;

    return this.notificationsService.deleteOneForUser(id, userId);
  }
}
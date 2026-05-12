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

  /**
   * Admin pode criar notificação manual.
   */
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  /**
   * Admin vê todas as notificações.
   */
  @Roles(Role.ADMIN)
  @Get('all')
  findAll() {
    return this.notificationsService.findAll();
  }

  /**
   * Usuário logado vê as próprias notificações.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get()
  findMyNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findByUser(userId);
  }

  /**
   * Usuário logado vê apenas as não lidas.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('unread')
  findMyUnreadNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findUnreadByUser(userId);
  }

  /**
   * Conta notificações não lidas do usuário logado.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('unread/count')
  countMyUnreadNotifications(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.countUnreadByUser(userId);
  }

  /**
   * Admin pode consultar notificações de qualquer usuário.
   */
  @Roles(Role.ADMIN)
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.notificationsService.findByUser(userId);
  }

  /**
   * Admin pode consultar não lidas de qualquer usuário.
   */
  @Roles(Role.ADMIN)
  @Get('user/:userId/unread')
  findUnreadByUser(@Param('userId') userId: string) {
    return this.notificationsService.findUnreadByUser(userId);
  }

  /**
   * Usuário marca uma notificação como lida.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  /**
   * Usuário logado marca todas as próprias notificações como lidas.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch('read-all')
  markMyAllAsRead(@Request() req: { user: any }) {
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Admin marca todas de um usuário como lidas.
   */
  @Roles(Role.ADMIN)
  @Patch('user/:userId/read-all')
  markAllAsRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
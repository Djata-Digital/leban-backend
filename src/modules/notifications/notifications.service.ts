import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

import {
  Notification,
  NotificationChannel,
  NotificationType,
} from './entities/notification.entity';

import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const user = await this.usersRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const notification = this.notificationsRepository.create({
      user,
      title: dto.title,
      message: dto.message,
      notificationType: dto.notificationType ?? NotificationType.SYSTEM,
      deliveryChannel: dto.deliveryChannel ?? NotificationChannel.IN_APP,
      isRead: false,
      readAt: null,
      deletedAt: null,
    });

    const saved = await this.notificationsRepository.save(notification);

    this.notificationsGateway.sendNotificationToUser(user.id, saved);

    const unread = await this.countUnreadByUser(user.id);
    this.notificationsGateway.sendUnreadCountToUser(user.id, unread.count);

    await this.sendExpoPushNotification(user, saved);

    return saved;
  }

  private async sendExpoPushNotification(
    user: User,
    notification: Notification,
  ): Promise<void> {
    try {
      const token = user.expoPushToken;

      if (!token) return;

      const isValidExpoToken =
        token.startsWith('ExpoPushToken[') ||
        token.startsWith('ExponentPushToken[');

      if (!isValidExpoToken) return;

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title: notification.title,
          body: notification.message,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          data: {
            notificationId: notification.id,
            type: notification.notificationType,
          },
        }),
      });
    } catch (error) {
      console.log('Erro ao enviar push notification:', error);
    }
  }

  async createBookingCreated(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Reserva criada',
      message: `Sua reserva ${bookingCode} foi criada com sucesso.`,
      notificationType: NotificationType.BOOKING_CREATED,
      deliveryChannel: NotificationChannel.PUSH,
    });
  }

  async createPaymentConfirmed(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Pagamento confirmado',
      message: `O pagamento da reserva ${bookingCode} foi confirmado. Seu bilhete já está disponível.`,
      notificationType: NotificationType.PAYMENT_CONFIRMED,
      deliveryChannel: NotificationChannel.PUSH,
    });
  }

  async createTicketIssued(userId: string, ticketNumber: string) {
    return this.create({
      userId,
      title: 'Bilhete emitido',
      message: `Seu bilhete ${ticketNumber} foi emitido com sucesso.`,
      notificationType: NotificationType.TICKET_ISSUED,
      deliveryChannel: NotificationChannel.PUSH,
    });
  }

  async createPassengerBoarded(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Embarque confirmado',
      message: `Seu embarque da reserva ${bookingCode} foi confirmado pelo motorista.`,
      notificationType: NotificationType.PASSENGER_BOARDED,
      deliveryChannel: NotificationChannel.PUSH,
    });
  }

  async createPassengerArrived(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Chegada confirmada',
      message: `Sua chegada ao destino da reserva ${bookingCode} foi confirmada pelo motorista.`,
      notificationType: NotificationType.PASSENGER_ARRIVED,
      deliveryChannel: NotificationChannel.PUSH,
    });
  }

  async findAll(): Promise<Notification[]> {
    return this.notificationsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: {
        user: { id: userId },
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findUnreadByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: {
        user: { id: userId },
        isRead: false,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async countUnreadByUser(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        user: { id: userId },
        isRead: false,
        deletedAt: IsNull(),
      },
    });

    return { count };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id,
        user: { id: userId },
        deletedAt: IsNull(),
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const saved = await this.notificationsRepository.save(notification);

    const unread = await this.countUnreadByUser(userId);
    this.notificationsGateway.sendUnreadCountToUser(userId, unread.count);

    return saved;
  }

  async markAllAsRead(userId: string): Promise<{ message: string }> {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
        isRead: false,
        deletedAt: IsNull(),
      },
    });

    if (notifications.length === 0) {
      return {
        message: 'Nenhuma notificação pendente.',
      };
    }

    for (const notification of notifications) {
      notification.isRead = true;
      notification.readAt = new Date();
    }

    await this.notificationsRepository.save(notifications);

    this.notificationsGateway.sendUnreadCountToUser(userId, 0);

    return {
      message: 'Todas as notificações foram marcadas como lidas.',
    };
  }

  async deleteOneForUser(
    notificationId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        user: { id: userId },
        deletedAt: IsNull(),
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    notification.deletedAt = new Date();

    await this.notificationsRepository.save(notification);

    const unread = await this.countUnreadByUser(userId);
    this.notificationsGateway.sendUnreadCountToUser(userId, unread.count);

    return {
      message: 'Notificação eliminada do app.',
    };
  }

  async deleteSelectedForUser(
    userId: string,
    notificationIds: string[],
  ): Promise<{ message: string; deletedCount: number }> {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return {
        message: 'Nenhuma notificação selecionada.',
        deletedCount: 0,
      };
    }

    const notifications = await this.notificationsRepository.find({
      where: notificationIds.map((id) => ({
        id,
        user: { id: userId },
        deletedAt: IsNull(),
      })),
    });

    for (const notification of notifications) {
      notification.deletedAt = new Date();
    }

    if (notifications.length > 0) {
      await this.notificationsRepository.save(notifications);
    }

    const unread = await this.countUnreadByUser(userId);
    this.notificationsGateway.sendUnreadCountToUser(userId, unread.count);

    return {
      message: 'Notificações selecionadas eliminadas.',
      deletedCount: notifications.length,
    };
  }

  async deleteAllForUser(
    userId: string,
  ): Promise<{ message: string; deletedCount: number }> {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
        deletedAt: IsNull(),
      },
    });

    for (const notification of notifications) {
      notification.deletedAt = new Date();
    }

    if (notifications.length > 0) {
      await this.notificationsRepository.save(notifications);
    }

    this.notificationsGateway.sendUnreadCountToUser(userId, 0);

    return {
      message: 'Todas as notificações foram eliminadas.',
      deletedCount: notifications.length,
    };
  }
}
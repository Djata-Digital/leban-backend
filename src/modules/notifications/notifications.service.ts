import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    });

    const saved = await this.notificationsRepository.save(notification);

    this.notificationsGateway.sendNotificationToUser(user.id, saved);

    return saved;
  }

  async createBookingCreated(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Reserva criada',
      message: `Sua reserva ${bookingCode} foi criada com sucesso.`,
      notificationType: NotificationType.BOOKING_CREATED,
      deliveryChannel: NotificationChannel.IN_APP,
    });
  }

  async createPaymentConfirmed(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Pagamento confirmado',
      message: `O pagamento da reserva ${bookingCode} foi confirmado. Seu bilhete já está disponível.`,
      notificationType: NotificationType.PAYMENT_CONFIRMED,
      deliveryChannel: NotificationChannel.IN_APP,
    });
  }

  async createTicketIssued(userId: string, ticketNumber: string) {
    return this.create({
      userId,
      title: 'Bilhete emitido',
      message: `Seu bilhete ${ticketNumber} foi emitido com sucesso.`,
      notificationType: NotificationType.TICKET_ISSUED,
      deliveryChannel: NotificationChannel.IN_APP,
    });
  }

  async createPassengerBoarded(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Embarque confirmado',
      message: `Seu embarque da reserva ${bookingCode} foi confirmado pelo motorista.`,
      notificationType: NotificationType.PASSENGER_BOARDED,
      deliveryChannel: NotificationChannel.IN_APP,
    });
  }

  async createPassengerArrived(userId: string, bookingCode: string) {
    return this.create({
      userId,
      title: 'Chegada confirmada',
      message: `Sua chegada ao destino da reserva ${bookingCode} foi confirmada pelo motorista.`,
      notificationType: NotificationType.PASSENGER_ARRIVED,
      deliveryChannel: NotificationChannel.IN_APP,
    });
  }

  async findAll(): Promise<Notification[]> {
    return this.notificationsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findUnreadByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: {
        user: { id: userId },
        isRead: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async countUnreadByUser(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        user: { id: userId },
        isRead: false,
      },
    });

    return { count };
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    notification.isRead = true;
    notification.readAt = new Date();

    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ message: string }> {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
        isRead: false,
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

    return {
      message: 'Todas as notificações foram marcadas como lidas.',
    };
  }
}
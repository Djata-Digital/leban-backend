import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  BOOKING_CREATED = 'booking_created',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  TICKET_ISSUED = 'ticket_issued',
  CARGO_APPROVED = 'cargo_approved',
  CARGO_REJECTED = 'cargo_rejected',
  TRIP_REMINDER = 'trip_reminder',
  PASSENGER_BOARDED = 'passenger_boarded',
  PASSENGER_ARRIVED = 'passenger_arrived',
  SYSTEM = 'system',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: 'CASCADE',
  })
  user: User;

  @Column({
    type: 'varchar',
    length: 150,
  })
  title: string;

  @Column({
    type: 'text',
  })
  message: string;

  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  notificationType: NotificationType;

  @Column({
    name: 'delivery_channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  deliveryChannel: NotificationChannel;

  @Column({
    name: 'is_read',
    default: false,
  })
  isRead: boolean;

  @Column({
    name: 'read_at',
    type: 'timestamp',
    nullable: true,
  })
  readAt?: Date | null;

  /**
   * Quando preenchido, a notificação some do app do usuário.
   * O registro continua no banco para histórico interno.
   */
  @Column({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deletedAt?: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
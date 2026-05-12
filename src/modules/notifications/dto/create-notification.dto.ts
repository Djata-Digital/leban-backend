import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationType,
} from '../entities/notification.entity';

/**
 * DTO usado para criar uma notificação.
 */
export class CreateNotificationDto {
  /**
   * ID do usuário que receberá a notificação.
   */
  @IsUUID()
  userId: string;

  /**
   * Título da notificação.
   */
  @IsString()
  @MaxLength(150)
  title: string;

  /**
   * Mensagem completa.
   */
  @IsString()
  message: string;

  /**
   * Tipo da notificação.
   */
  @IsOptional()
  @IsEnum(NotificationType)
  notificationType?: NotificationType;

  /**
   * Canal de entrega.
   */
  @IsOptional()
  @IsEnum(NotificationChannel)
  deliveryChannel?: NotificationChannel;
}
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';
import { BookingStatus, PaymentStatus } from '../entities/booking.entity';

/**
 * DTO usado para atualizar uma reserva.
 */
export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  /**
   * Permite atualizar status da reserva.
   */
  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  /**
   * Permite atualizar status do pagamento.
   */
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
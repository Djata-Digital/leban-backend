import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

import { Ticket } from './entities/ticket.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { SeatReservation } from '../seat-reservations/entities/seat-reservation.entity';

/**
 * Módulo de bilhetes digitais.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      Booking,
      SeatReservation,
    ]),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],

  // Exportamos para o BookingsService emitir bilhete automaticamente
  exports: [TicketsService],
})
export class TicketsModule {}
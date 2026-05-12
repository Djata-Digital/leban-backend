import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

import { Booking } from './entities/booking.entity';

import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';

import { SeatReservation } from '../seat-reservations/entities/seat-reservation.entity';

import { SellerRoute } from '../seller-routes/entities/seller-route.entity';

import { CargoRequest } from '../cargo-requests/entities/cargo-request.entity';

import { BoardingPoint } from '../boarding-points/entities/boarding-point.entity';

import { TicketsModule } from '../tickets/tickets.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Trip,
      User,
      SeatReservation,
      SellerRoute,
      CargoRequest,
      BoardingPoint,
    ]),

    TicketsModule,

    NotificationsModule,
  ],

  controllers: [BookingsController],

  providers: [BookingsService],

  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatReservationsController } from './seat-reservations.controller';
import { SeatReservationsService } from './seat-reservations.service';
import { SeatReservation } from './entities/seat-reservation.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SeatReservation,
      Trip,
      Booking,
      VehicleSeat,
    ]),
    NotificationsModule,
  ],
  controllers: [SeatReservationsController],
  providers: [SeatReservationsService],
  exports: [SeatReservationsService],
})
export class SeatReservationsModule {}
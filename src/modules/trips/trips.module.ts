import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';

import { Trip } from './entities/trip.entity';
import { Route } from '../routes/entities/route.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';
import { SeatReservation } from '../seat-reservations/entities/seat-reservation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      Route,
      Vehicle,
      User,
      VehicleSeat,
      SellerRoute,
      SeatReservation, // necessário para usar SeatReservationRepository no TripsService
    ]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
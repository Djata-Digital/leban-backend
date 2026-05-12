import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { User } from '../modules/users/entities/user.entity';

import { Vehicle } from '../modules/vehicles/entities/vehicle.entity';
import { VehicleSeat } from '../modules/vehicle-seats/entities/vehicle-seat.entity';

import { Route } from '../modules/routes/entities/route.entity';

import { Trip } from '../modules/trips/entities/trip.entity';

import { Booking } from '../modules/bookings/entities/booking.entity';

import { SeatReservation } from '../modules/seat-reservations/entities/seat-reservation.entity';

import { Ticket } from '../modules/tickets/entities/ticket.entity';

import { Payment } from '../modules/payments/entities/payment.entity';

import { CargoRequest } from '../modules/cargo-requests/entities/cargo-request.entity';

import { Notification } from '../modules/notifications/entities/notification.entity';

import { SellerRoute } from '../modules/seller-routes/entities/seller-route.entity';

import { BoardingPoint } from '../modules/boarding-points/entities/boarding-point.entity';

import { Review } from '../modules/reviews/entities/review.entity';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',

  host: configService.get<string>('DATABASE_HOST'),

  port: configService.get<number>('DATABASE_PORT'),

  username: configService.get<string>('DATABASE_USERNAME'),

  password: configService.get<string>('DATABASE_PASSWORD'),

  database: configService.get<string>('DATABASE_NAME'),

  ssl: configService.get<boolean>('DATABASE_SSL')
    ? { rejectUnauthorized: false }
    : false,

  entities: [
    User,

    Vehicle,
    VehicleSeat,

    Route,

    Trip,

    Booking,

    SeatReservation,

    Ticket,

    Payment,

    CargoRequest,

    Notification,

    SellerRoute,

    BoardingPoint,

    Review,
  ],

  synchronize: true,

  logging: false,
});
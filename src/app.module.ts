import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from './config/env.validation';
import { getTypeOrmConfig } from './database/typeorm.config';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { VehicleSeatsModule } from './modules/vehicle-seats/vehicle-seats.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TripsModule } from './modules/trips/trips.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SeatReservationsModule } from './modules/seat-reservations/seat-reservations.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CargoRequestsModule } from './modules/cargo-requests/cargo-requests.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SellerRoutesModule } from './modules/seller-routes/seller-routes.module';
import { FinancialModule } from './modules/financial/financial.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { BoardingPointsModule } from './modules/boarding-points/boarding-points.module';

/**
 * Módulo raiz da aplicação.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),

    AuthModule,
    UsersModule,
    VehiclesModule,
    VehicleSeatsModule,
    RoutesModule,
    TripsModule,
    BookingsModule,
    SeatReservationsModule,
    TicketsModule,
    PaymentsModule,
    CargoRequestsModule,
    NotificationsModule,
    SellerRoutesModule,
    FinancialModule,
    ReviewsModule,
    BoardingPointsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
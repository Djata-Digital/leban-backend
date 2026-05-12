import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoRequestsController } from './cargo-requests.controller';
import { CargoRequestsService } from './cargo-requests.service';
import { CargoRequest } from './entities/cargo-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';

/**
 * Módulo de carga/bagagem.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CargoRequest, Booking, User])],
  controllers: [CargoRequestsController],
  providers: [CargoRequestsService],
  exports: [CargoRequestsService, TypeOrmModule],
})
export class CargoRequestsModule {}
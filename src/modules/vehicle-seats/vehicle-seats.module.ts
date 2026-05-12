import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleSeatsService } from './vehicle-seats.service';
import { VehicleSeatsController } from './vehicle-seats.controller';
import { VehicleSeat } from './entities/vehicle-seat.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

/**
 * Módulo de assentos
 */
@Module({
  imports: [TypeOrmModule.forFeature([VehicleSeat, Vehicle])],
  controllers: [VehicleSeatsController],
  providers: [VehicleSeatsService],
})
export class VehicleSeatsModule {}
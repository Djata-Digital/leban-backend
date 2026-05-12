import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

import { Vehicle } from './entities/vehicle.entity';
import { Route } from '../routes/entities/route.entity';
import { User } from '../users/entities/user.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      Route,
      User,
      SellerRoute,
      VehicleSeat,
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
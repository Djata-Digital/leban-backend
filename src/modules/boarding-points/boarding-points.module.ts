import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BoardingPoint } from './entities/boarding-point.entity';

import { Route } from '../routes/entities/route.entity';

import { BoardingPointsController } from './boarding-points.controller';
import { BoardingPointsService } from './boarding-points.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BoardingPoint,
      Route,
    ]),
  ],

  controllers: [BoardingPointsController],

  providers: [BoardingPointsService],

  exports: [
    BoardingPointsService,
    TypeOrmModule,
  ],
})
export class BoardingPointsModule {}
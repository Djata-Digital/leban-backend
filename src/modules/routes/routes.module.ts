import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { Route } from './entities/route.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';

/**
 * Módulo de rotas comerciais.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Route, SellerRoute])],
  controllers: [RoutesController],
  providers: [RoutesService],
  exports: [RoutesService, TypeOrmModule],
})
export class RoutesModule {}
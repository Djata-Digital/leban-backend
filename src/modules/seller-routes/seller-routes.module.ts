import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerRoutesController } from './seller-routes.controller';
import { SellerRoutesService } from './seller-routes.service';
import { SellerRoute } from './entities/seller-route.entity';
import { User } from '../users/entities/user.entity';
import { Route } from '../routes/entities/route.entity';

/**
 * Módulo responsável pela associação vendedor ↔ rota.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SellerRoute, User, Route])],
  controllers: [SellerRoutesController],
  providers: [SellerRoutesService],
  exports: [SellerRoutesService, TypeOrmModule],
})
export class SellerRoutesModule {}
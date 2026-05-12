import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { Booking } from '../bookings/entities/booking.entity';

/**
 * Módulo financeiro.
 * Responsável por relatórios de vendas, comissões e valores da empresa.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [FinancialController],
  providers: [FinancialService],
})
export class FinancialModule {}
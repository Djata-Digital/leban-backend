import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VehicleSeatsService } from './vehicle-seats.service';
import { CreateVehicleSeatDto } from './dto/create-vehicle-seat.dto';
import { GenerateSeatsDto } from './dto/generate-seats.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Controller responsável pelas rotas HTTP de assentos dos veículos.
 *
 * ⚠️ Está público temporariamente para facilitar os testes.
 * Depois vamos proteger com autenticação e permissões corretas.
 */
@Public()
@Controller('vehicle-seats')
export class VehicleSeatsController {
  constructor(private readonly service: VehicleSeatsService) {}

  /**
   * Cria um assento manualmente.
   */
  @Post()
  create(@Body() dto: CreateVehicleSeatDto) {
    return this.service.create(dto);
  }

  /**
   * Gera vários assentos automaticamente para um veículo.
   */
  @Post('generate')
  generate(@Body() dto: GenerateSeatsDto) {
    return this.service.generateSeats(dto);
  }

  /**
   * Lista todos os assentos de um veículo.
   */
  @Get(':vehicleId')
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.service.findByVehicle(vehicleId);
  }
}
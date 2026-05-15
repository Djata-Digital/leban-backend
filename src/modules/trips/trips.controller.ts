import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';

import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/**
 * Controller responsável pelas rotas HTTP de viagens.
 */
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  /**
   * Cria uma nova viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Post()
  create(@Body() dto: CreateTripDto, @Request() req: { user: any }) {
    return this.tripsService.create(dto, req.user);
  }

  /**
   * Lista viagens para admin/seller.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  findAll(@Request() req: { user: any }) {
    return this.tripsService.findAll(req.user);
  }

  /**
   * Pesquisa viagens disponíveis para passageiro.
   *
   * Agora aceita:
   * - origin
   * - destination
   * - vehicleType
   * - routeId
   * - date
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Get('search')
  search(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('routeId') routeId?: string,
    @Query('date') date?: string,
  ) {
    return this.tripsService.search({
      origin,
      destination,
      vehicleType,
      routeId,
      date,
    });
  }

  /**
   * Lista viagens disponíveis para passageiro comprar.
   *
   * Mantido por compatibilidade.
   * Depois o app passageiro deve preferir /trips/search.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Get('available')
  findAvailable() {
    return this.tripsService.findAvailable();
  }

  /**
   * Lista viagens atribuídas ao motorista logado.
   */
  @Roles(Role.DRIVER)
  @Get('my-driver-trips')
  findMyDriverTrips(@Request() req: { user: any }) {
    return this.tripsService.findMyDriverTrips(req.user.sub);
  }

  /**
   * Lista os assentos do veículo usado em uma viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get(':id/seats')
  findSeatsByTrip(@Param('id') id: string) {
    return this.tripsService.findSeatsByTrip(id);
  }

  /**
   * Busca uma viagem pelo ID.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  /**
   * Atualiza uma viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  /**
   * Cancela uma viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tripsService.cancel(id);
  }

  /**
   * Coloca a viagem em embarque.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/start-boarding')
  startBoarding(@Param('id') id: string, @Request() req: { user: any }) {
    return this.tripsService.startBoarding(id, req.user);
  }

  /**
   * Inicia a viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/start')
  startTrip(@Param('id') id: string, @Request() req: { user: any }) {
    return this.tripsService.startTrip(id, req.user);
  }

  /**
   * Finaliza a viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @Request() req: { user: any }) {
    return this.tripsService.complete(id, req.user);
  }
}
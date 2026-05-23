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
  create(
    @Body() dto: CreateTripDto,
    @Request() req: { user: any },
  ) {
    return this.tripsService.create(dto, req.user);
  }

  /**
   * NOVO ENDPOINT LEVE
   * Muito mais rápido para dashboard/listagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Get('seller-light')
  findAllLight(@Request() req: { user: any }) {
    return this.tripsService.findAllLight(req.user);
  }

  /**
   * Lista viagens para admin/seller.
   * (COMPLETO)
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  findAll(@Request() req: { user: any }) {
    return this.tripsService.findAll(req.user);
  }

  /**
   * Pesquisa viagens disponíveis para passageiro.
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
   * Lista viagens disponíveis.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Get('available')
  findAvailable() {
    return this.tripsService.findAvailable();
  }

  /**
   * Lista viagens do motorista.
   */
  @Get('my-driver-trips')
  findMyDriverTrips(
    @Request() req: { user: any },
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tripsService.findMyDriverTrips(req.user.sub, {
      status,
      startDate,
      endDate,
    });
  }

  /**
   * Lista assentos da viagem.
   */
  @Roles(
    Role.ADMIN,
    Role.SELLER,
    Role.PASSENGER,
    Role.DRIVER,
  )
  @Get(':id/seats')
  findSeatsByTrip(
    @Param('id') id: string,
  ) {
    return this.tripsService.findSeatsByTrip(id);
  }

  /**
   * Busca viagem por ID.
   */
  @Roles(
    Role.ADMIN,
    Role.SELLER,
    Role.PASSENGER,
    Role.DRIVER,
  )
  @Roles(Role.DRIVER)
  @Get(':id/driver-details')
  findDriverTripDetails(
    @Param('id') id: string,
    @Request() req: { user: any },
  ) {
    return this.tripsService.findDriverTripDetails(id, req.user.sub);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  /**
   * Atualiza viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(id, dto);
  }

  /**
   * Cancela viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tripsService.cancel(id);
  }

  /**
   * Inicia embarque.
   */
  @Roles(
    Role.ADMIN,
    Role.SELLER,
    Role.DRIVER,
  )
  @Patch(':id/start-boarding')
  startBoarding(
    @Param('id') id: string,
    @Request() req: { user: any },
  ) {
    return this.tripsService.startBoarding(
      id,
      req.user,
    );
  }

  /**
   * Inicia viagem.
   */
  @Roles(
    Role.ADMIN,
    Role.SELLER,
    Role.DRIVER,
  )
  @Patch(':id/start')
  startTrip(
    @Param('id') id: string,
    @Request() req: { user: any },
  ) {
    return this.tripsService.startTrip(
      id,
      req.user,
    );
  }

  /**
   * Finaliza viagem.
   */
  @Roles(
    Role.ADMIN,
    Role.SELLER,
    Role.DRIVER,
  )
  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Request() req: { user: any },
  ) {
    return this.tripsService.complete(
      id,
      req.user,
    );
  }
}
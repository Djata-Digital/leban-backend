import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { SeatReservationsService } from './seat-reservations.service';
import { CreateSeatReservationDto } from './dto/create-seat-reservation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/**
 * Controller responsável pelas rotas HTTP de reserva de assentos.
 */
@Controller('seat-reservations')
export class SeatReservationsController {
  constructor(private readonly service: SeatReservationsService) {}

  /**
   * Segura temporariamente um assento por 1 minutos.
   *
   * Usa status HELD.
   * Serve quando o passageiro toca no assento antes de confirmar reserva.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Post('hold')
  holdSeat(
    @Body()
    dto: {
      tripId: string;
      vehicleSeatId: string;
    },
  ) {
    return this.service.holdSeat(dto);
  }

  /**
   * Libera uma seleção temporária.
   *
   * Usa quando o passageiro desmarca o assento antes de confirmar.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Patch('hold/release')
  releaseHeldSeat(
    @Body()
    dto: {
      tripId: string;
      vehicleSeatId: string;
    },
  ) {
    return this.service.releaseHeldSeat(dto);
  }

  /**
   * Reserva definitivamente um assento específico.
   *
   * Aqui já é depois de confirmar a reserva principal.
   * Se existir HELD para o assento, ele vira RESERVED.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Post()
  reserveSeat(@Body() dto: CreateSeatReservationDto) {
    return this.service.reserveSeat(dto);
  }

  /**
   * Lista assentos reservados/vendidos/temporariamente ocupados de uma viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('trip/:tripId')
  findByTrip(@Param('tripId') tripId: string) {
    return this.service.findByTrip(tripId);
  }

  /**
   * Confirma todos os assentos de um booking.
   * Apenas admin/seller deve confirmar pagamento.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch('booking/:bookingId/confirm')
  confirmByBooking(@Param('bookingId') bookingId: string) {
    return this.service.confirmByBooking(bookingId);
  }

  /**
   * Cancela todos os assentos reservados de um booking.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Patch('booking/:bookingId/cancel')
  cancelByBooking(@Param('bookingId') bookingId: string) {
    return this.service.cancelByBooking(bookingId);
  }

  /**
   * Expira seleções temporárias antigas manualmente.
   */
  @Roles(Role.ADMIN)
  @Patch('expire-old')
  expireOldReservations() {
    return this.service.expireOldReservations();
  }
}
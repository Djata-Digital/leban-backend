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
   * Reserva um assento específico.
   * Passageiro precisa poder fazer isso pelo app.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Post()
  reserveSeat(@Body() dto: CreateSeatReservationDto) {
    return this.service.reserveSeat(dto);
  }

  /**
   * Lista assentos reservados/vendidos de uma viagem.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
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
   * Expira reservas antigas manualmente.
   */
  @Roles(Role.ADMIN)
  @Patch('expire-old')
  expireOldReservations() {
    return this.service.expireOldReservations();
  }
}
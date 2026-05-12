import { IsUUID } from 'class-validator';

/**
 * DTO usado para reservar um assento específico.
 */
export class CreateSeatReservationDto {
  /**
   * ID da viagem.
   */
  @IsUUID()
  tripId: string;

  /**
   * ID da reserva/compra principal.
   */
  @IsUUID()
  bookingId: string;

  /**
   * ID do assento do veículo.
   */
  @IsUUID()
  vehicleSeatId: string;
}
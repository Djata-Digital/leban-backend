import { IsUUID } from 'class-validator';

/**
 * DTO usado para emitir um bilhete a partir de uma reserva confirmada.
 */
export class CreateTicketDto {
  /**
   * ID da reserva/compra.
   */
  @IsUUID()
  bookingId: string;
}
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO usado para criar uma reserva inicial.
 */
export class CreateBookingDto {
  /**
   * ID da viagem que será reservada.
   */
  @IsUUID()
  tripId: string;

  /**
   * ID do usuário comprador.
   */
  @IsUUID()
  buyerId: string;

  /**
   * Nome do passageiro que vai viajar.
   */
  @IsString()
  @MaxLength(150)
  passengerName: string;

  /**
   * Telefone do passageiro.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  passengerPhone?: string;

  /**
   * Local de recolha manual antigo.
   * Mantemos para compatibilidade.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pickupLocation?: string;

  /**
   * Ponto de embarque.
   * Agora será obrigatório.
   */
  @IsUUID()
  boardingPointId: string;

  /**
   * Ponto de desembarque.
   * Opcional.
   */
  @IsOptional()
  @IsUUID()
  dropoffPointId?: string;

  /**
   * Quantidade de assentos.
   */
  @IsInt()
  @Min(1)
  seatQuantity: number;
}
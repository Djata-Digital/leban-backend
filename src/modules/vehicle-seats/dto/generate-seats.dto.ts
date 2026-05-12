import { IsNumber, IsString } from 'class-validator';

/**
 * DTO para gerar vários assentos automaticamente
 */
export class GenerateSeatsDto {
  @IsString()
  vehicleId: string;

  /**
   * Quantidade de assentos que o veículo terá
   */
  @IsNumber()
  totalSeats: number;
}
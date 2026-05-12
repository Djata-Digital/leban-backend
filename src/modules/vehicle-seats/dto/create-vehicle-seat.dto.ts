import { IsNumber, IsString } from 'class-validator';

/**
 * DTO para criação manual de um assento
 */
export class CreateVehicleSeatDto {
  @IsString()
  vehicleId: string;

  @IsNumber()
  seatNumber: number;

  @IsString()
  seatLabel: string;
}
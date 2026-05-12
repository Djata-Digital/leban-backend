import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { VehicleType } from '../entities/vehicle.entity';

/**
 * DTO para criação de veículos.
 */
export class CreateVehicleDto {
  @IsString()
  @MaxLength(20)
  plateNumber: string;

  @IsString()
  @MaxLength(100)
  model: string;

  @IsString()
  @MaxLength(100)
  brand: string;

  @IsString()
  @MaxLength(50)
  color: string;

  @IsInt()
  @Min(1900)
  manufactureYear: number;

  @IsInt()
  @Min(1)
  seatCount: number;

  /**
   * Tipo de carro
   */
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerPhone?: string;

  @IsOptional()
  @IsInt()
  sellerCommissionAmount?: number;

  /**
   * ID da rota
   */
  @IsOptional()
  @IsString()
  routeId?: string;

  /**
   * 🔥 NOVO
   * Motorista associado ao veículo
   */
  @IsOptional()
  @IsString()
  driverId?: string;
}
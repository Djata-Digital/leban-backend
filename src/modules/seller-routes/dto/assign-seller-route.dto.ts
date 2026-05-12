import { IsEnum, IsUUID } from 'class-validator';
import { VehicleType } from '../../vehicles/entities/vehicle.entity';

/**
 * DTO usado para atribuir rota a um vendedor.
 *
 * Agora também inclui o tipo de carro (serviço).
 */
export class AssignSellerRouteDto {
  /**
   * ID do vendedor
   */
  @IsUUID()
  sellerId: string;

  /**
   * ID da rota
   */
  @IsUUID()
  routeId: string;

  /**
   * 🔥 NOVO CAMPO
   * Tipo de carro que o vendedor pode vender nessa rota
   */
  @IsEnum(VehicleType)
  vehicleType: VehicleType;
}
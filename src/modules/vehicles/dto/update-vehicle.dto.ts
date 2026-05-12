import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicle.dto';

/**
 * DTO para atualização de veículo.
 * Herdamos tudo do CreateVehicleDto,
 * mas deixando os campos opcionais.
 */
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
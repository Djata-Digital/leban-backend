import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';
import { TripStatus } from '../entities/trip.entity';

/**
 * DTO usado para atualizar uma viagem.
 * Todos os campos de CreateTripDto ficam opcionais.
 */
export class UpdateTripDto extends PartialType(CreateTripDto) {
  /**
   * Permite também atualizar o status da viagem.
   */
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
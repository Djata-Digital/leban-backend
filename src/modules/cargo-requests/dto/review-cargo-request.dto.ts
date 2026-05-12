import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CargoRequestStatus } from '../entities/cargo-request.entity';

/**
 * DTO usado para aprovar ou rejeitar uma carga.
 */
export class ReviewCargoRequestDto {
  /**
   * Status final da revisão.
   */
  @IsEnum(CargoRequestStatus)
  cargoStatus: CargoRequestStatus;

  /**
   * Preço final da carga.
   * Obrigatório quando aprovado.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  /**
   * Usuário que revisou.
   */
  @IsOptional()
  @IsUUID()
  reviewedByUserId?: string;

  /**
   * Observação da revisão.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
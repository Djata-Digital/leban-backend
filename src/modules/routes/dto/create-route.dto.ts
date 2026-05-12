import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO usado para criar uma nova rota.
 */
export class CreateRouteDto {
  /**
   * Origem da rota.
   */
  @IsString()
  @MaxLength(150)
  originName: string;

  /**
   * Destino da rota.
   */
  @IsString()
  @MaxLength(150)
  destinationName: string;

  /**
   * Distância aproximada em quilômetros.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  /**
   * Duração estimada em minutos.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDurationMinutes?: number;

  /**
   * Preço base da passagem.
   */
  @IsNumber()
  @Min(0)
  basePrice: number;

  /**
   * Define se a rota já nasce ativa.
   */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
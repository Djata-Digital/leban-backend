import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DepartureMode } from '../entities/trip.entity';

export class CreateTripDto {
  @IsUUID()
  routeId: string;

  @IsUUID()
  vehicleId: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsEnum(DepartureMode)
  departureMode?: DepartureMode;

  @IsOptional()
  @IsDateString()
  boardingDate?: string;

  @IsOptional()
  @IsDateString()
  departureDatetime?: string;

  @IsOptional()
  @IsDateString()
  estimatedArrivalDatetime?: string;

  @IsNumber()
  @Min(0)
  baseFare: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
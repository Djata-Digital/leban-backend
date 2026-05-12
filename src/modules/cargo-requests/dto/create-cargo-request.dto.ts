import {
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Allow,
} from 'class-validator';

export class CreateCargoRequestDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  cargoDescription: string;

  @IsOptional()
  @IsNumberString()
  estimatedWeightKg?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsNumberString()
  finalPrice?: string;

  /**
   * Necessário porque no multipart/form-data
   * o campo "photo" pode aparecer no body antes de ser tratado pelo Multer.
   */
  @IsOptional()
  @Allow()
  photo?: any;
}
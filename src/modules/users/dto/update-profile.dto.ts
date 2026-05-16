import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => String(value || '').trim())
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => {
    const clean = String(value || '').trim();
    return clean || null;
  })
  nickname?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  @Transform(({ value }) => {
    const clean = String(value || '').trim();
    return clean || undefined;
  })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => String(value || '').trim())
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  newPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password?: string;
}
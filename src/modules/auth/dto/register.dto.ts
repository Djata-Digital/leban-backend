import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

/**
 * DTO de cadastro.
 * No início, vamos permitir cadastro simples.
 */
export class RegisterDto {
  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsString()
  @MaxLength(30)
  phoneNumber: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nickname?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  /**
   * Em produção, normalmente não deixaríamos o usuário comum
   * escolher qualquer role livremente. Para já, deixamos opcional,
   * mas o ideal é controlar isso no admin.
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de login.
 */
export class LoginDto {
  @IsString()
  @MaxLength(30)
  phoneNumber: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;
}
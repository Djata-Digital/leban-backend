import { IsString, MinLength } from 'class-validator';

export class UpdateAdminPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(6)
  confirmPassword: string;
}
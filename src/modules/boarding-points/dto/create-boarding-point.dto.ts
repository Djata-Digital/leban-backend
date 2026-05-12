import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBoardingPointDto {
  @IsUUID()
  routeId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsInt()
  @Min(1)
  orderNumber: number;
}
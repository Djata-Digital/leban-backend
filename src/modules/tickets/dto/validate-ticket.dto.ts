import { IsString, MaxLength } from 'class-validator';

/**
 * DTO usado para validar bilhete pelo código manual.
 */
export class ValidateTicketDto {
  /**
   * Código de validação do bilhete.
   */
  @IsString()
  @MaxLength(30)
  validationCode: string;
}
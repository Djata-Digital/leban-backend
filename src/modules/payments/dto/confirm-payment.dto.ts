import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO usado para confirmar pagamento manualmente.
 */
export class ConfirmPaymentDto {
  /**
   * ID do usuário que recebeu o pagamento.
   * Pode ser vendedor ou administrador.
   */
  @IsOptional()
  @IsUUID()
  receivedByUserId?: string;

  /**
   * Referência externa opcional.
   * Exemplo: código de recibo, transação, etc.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

/**
 * DTO usado para registrar uma tentativa ou registro inicial de pagamento.
 */
export class CreatePaymentDto {
  /**
   * ID da reserva/compra que será paga.
   */
  @IsUUID()
  bookingId: string;

  /**
   * Método de pagamento.
   */
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /**
   * Valor pago ou a pagar.
   */
  @IsNumber()
  @Min(0)
  amount: number;

  /**
   * Moeda.
   * Exemplo: XOF, BRL, USD.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /**
   * Nome do provedor externo, se existir.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerName?: string;

  /**
   * Referência externa, se existir.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}
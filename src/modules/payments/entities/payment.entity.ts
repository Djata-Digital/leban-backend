import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Métodos de pagamento aceitos pelo sistema.
 * No início, podemos usar dinheiro/manual.
 * Depois dá para adicionar integração com Mobile Money, cartão, banco, etc.
 */
export enum PaymentMethod {
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
}

/**
 * Status possíveis de um pagamento.
 */
export enum PaymentRecordStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Entidade que registra pagamentos ligados a uma reserva.
 */
@Entity('payments')
export class Payment {
  /**
   * ID único do pagamento.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reserva/compra ligada ao pagamento.
   */
  @ManyToOne(() => Booking, { eager: true, onDelete: 'CASCADE' })
  booking: Booking;

  /**
   * Método usado para pagar.
   */
  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  /**
   * Valor do pagamento.
   */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  /**
   * Moeda usada.
   * Para Guiné-Bissau, normalmente XOF.
   */
  @Column({ name: 'currency_code', type: 'varchar', length: 10, default: 'XOF' })
  currencyCode: string;

  /**
   * Status do pagamento.
   */
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentRecordStatus,
    default: PaymentRecordStatus.PENDING,
  })
  paymentStatus: PaymentRecordStatus;

  /**
   * Usuário que recebeu/confirmou o pagamento.
   * Pode ser vendedor/admin.
   */
  @ManyToOne(() => User, { eager: true, nullable: true })
  receivedBy?: User | null;

  /**
   * Nome do provedor externo.
   * Exemplo futuro: Orange Money, MTN, Stripe, banco, etc.
   */
  @Column({ name: 'provider_name', type: 'varchar', length: 80, nullable: true })
  providerName?: string | null;

  /**
   * Referência externa do pagamento.
   */
  @Column({ name: 'external_reference', type: 'varchar', length: 120, nullable: true })
  externalReference?: string | null;

  /**
   * Data/hora em que o pagamento foi confirmado.
   */
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  /**
   * Data de criação.
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Data da última atualização.
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
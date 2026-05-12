import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

/**
 * Status possíveis de um bilhete.
 */
export enum TicketStatus {
  ISSUED = 'issued',
  USED = 'used',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Entidade que representa o bilhete digital.
 * Cada bilhete pertence a uma reserva/compra.
 */
@Entity('tickets')
export class Ticket {
  /**
   * ID único do bilhete.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reserva/compra ligada ao bilhete.
   */
  @ManyToOne(() => Booking, { eager: true, onDelete: 'CASCADE' })
  booking: Booking;

  /**
   * Número amigável do bilhete.
   * Exemplo: TK-123456-ABCD
   */
  @Column({ name: 'ticket_number', type: 'varchar', length: 60, unique: true })
  ticketNumber: string;

  /**
   * Valor que será usado para gerar o QR Code.
   */
  @Column({ name: 'qr_code_value', type: 'text' })
  qrCodeValue: string;

  /**
   * Código curto para validação manual.
   */
  @Column({ name: 'validation_code', type: 'varchar', length: 30, unique: true })
  validationCode: string;

  /**
   * Status atual do bilhete.
   */
  @Column({
    name: 'ticket_status',
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ISSUED,
  })
  ticketStatus: TicketStatus;

  /**
   * Data/hora de emissão.
   */
  @CreateDateColumn({ name: 'issued_at' })
  issuedAt: Date;

  /**
   * Data/hora em que o bilhete foi validado no embarque.
   */
  @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
  validatedAt?: Date | null;
}
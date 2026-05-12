import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Trip } from '../../trips/entities/trip.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { VehicleSeat } from '../../vehicle-seats/entities/vehicle-seat.entity';

/**
 * Status possíveis de uma reserva de assento.
 */
export enum SeatReservationStatus {
  RESERVED = 'reserved',
  SOLD = 'sold',
  RELEASED = 'released',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Entidade que liga:
 * - viagem
 * - reserva/compra
 * - assento do veículo
 *
 * Essa tabela é essencial para impedir que o mesmo assento
 * seja vendido duas vezes na mesma viagem.
 */
@Entity('seat_reservations')
@Index(['trip', 'vehicleSeat'])
export class SeatReservation {
  /**
   * ID único da reserva de assento.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Viagem onde o assento está sendo reservado.
   */
  @ManyToOne(() => Trip, { eager: true })
  trip: Trip;

  /**
   * Booking/reserva principal ligada a este assento.
   */
  @ManyToOne(() => Booking, { eager: true, onDelete: 'CASCADE' })
  booking: Booking;

  /**
   * Assento específico do veículo.
   */
  @ManyToOne(() => VehicleSeat, { eager: true })
  vehicleSeat: VehicleSeat;

  /**
   * Status atual do assento nesta viagem.
   */
  @Column({
    name: 'reservation_status',
    type: 'enum',
    enum: SeatReservationStatus,
    default: SeatReservationStatus.RESERVED,
  })
  reservationStatus: SeatReservationStatus;

  /**
   * Data/hora em que o assento foi reservado.
   */
  @Column({ name: 'reserved_at', type: 'timestamp' })
  reservedAt: Date;

  /**
   * Data/hora em que a reserva temporária expira.
   */
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  /**
   * Data/hora em que o assento foi vendido/confirmado.
   */
  @Column({ name: 'sold_at', type: 'timestamp', nullable: true })
  soldAt?: Date | null;

  /**
   * Data/hora de cancelamento.
   */
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  /**
   * Data de criação do registro.
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Data da última atualização.
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
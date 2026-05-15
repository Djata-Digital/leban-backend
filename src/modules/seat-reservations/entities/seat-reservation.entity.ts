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
  /**
   * Assento selecionado temporariamente.
   * Expira automaticamente se o passageiro não confirmar.
   */
  HELD = 'held',

  /**
   * Reserva confirmada pelo passageiro.
   * Não expira automaticamente.
   */
  RESERVED = 'reserved',

  /**
   * Assento vendido/pagamento confirmado.
   */
  SOLD = 'sold',

  /**
   * Assento liberado manualmente.
   */
  RELEASED = 'released',

  /**
   * Reserva cancelada.
   */
  CANCELLED = 'cancelled',

  /**
   * Seleção temporária expirada.
   */
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
   *
   * Em reservas temporárias HELD, este campo pode ficar vazio,
   * porque o passageiro ainda não confirmou a reserva principal.
   */
  @ManyToOne(() => Booking, {
    eager: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
  booking?: Booking | null;

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
    default: SeatReservationStatus.HELD,
  })
  reservationStatus: SeatReservationStatus;

  /**
   * Data/hora em que o assento foi reservado ou selecionado.
   */
  @Column({ name: 'reserved_at', type: 'timestamp' })
  reservedAt: Date;

  /**
   * Data/hora em que a seleção temporária expira.
   *
   * Só deve ser preenchido quando reservationStatus = HELD.
   * Para RESERVED e SOLD deve ficar null.
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
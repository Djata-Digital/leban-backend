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
 * Status possíveis da análise da carga.
 */
export enum CargoRequestStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Entidade que representa o pedido de transporte de carga/bagagem.
 */
@Entity('cargo_requests')
export class CargoRequest {
  /**
   * ID único do pedido de carga.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reserva/compra ligada à carga.
   */
  @ManyToOne(() => Booking, {
    eager: true,
    onDelete: 'CASCADE',
  })
  booking: Booking;

  /**
   * Descrição da carga informada pelo passageiro/vendedor.
   */
  @Column({
    name: 'cargo_description',
    type: 'text',
  })
  cargoDescription: string;

  /**
   * Peso estimado em kg.
   */
  @Column({
    name: 'estimated_weight_kg',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedWeightKg?: number | null;

  /**
   * Foto da carga.
   */
  @Column({
    name: 'photo_url',
    type: 'text',
    nullable: true,
  })
  photoUrl?: string | null;

  /**
   * Status da análise da carga.
   */
  @Column({
    name: 'cargo_status',
    type: 'enum',
    enum: CargoRequestStatus,
    default: CargoRequestStatus.PENDING_REVIEW,
  })
  cargoStatus: CargoRequestStatus;

  /**
   * Preço final aprovado para transporte da carga.
   */
  @Column({
    name: 'final_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  finalPrice?: number | null;

  /**
   * Passageiro aceitou o preço da carga?
   *
   * null = ainda não respondeu
   * true = aceitou
   * false = recusou
   */
  @Column({
    name: 'passenger_accepted',
    type: 'boolean',
    nullable: true,
  })
  passengerAccepted?: boolean | null;

  /**
   * Data/hora em que o passageiro aceitou.
   */
  @Column({
    name: 'passenger_accepted_at',
    type: 'timestamp',
    nullable: true,
  })
  passengerAcceptedAt?: Date | null;

  /**
   * Data/hora em que o passageiro recusou.
   */
  @Column({
    name: 'passenger_rejected_at',
    type: 'timestamp',
    nullable: true,
  })
  passengerRejectedAt?: Date | null;

  /**
   * Usuário que revisou/aprovou/rejeitou a carga.
   */
  @ManyToOne(() => User, {
    eager: true,
    nullable: true,
  })
  reviewedBy?: User | null;

  /**
   * Data/hora da revisão.
   */
  @Column({
    name: 'reviewed_at',
    type: 'timestamp',
    nullable: true,
  })
  reviewedAt?: Date | null;

  /**
   * Observação da revisão.
   */
  @Column({
    name: 'review_note',
    type: 'text',
    nullable: true,
  })
  reviewNote?: string | null;

  /**
   * Data de criação.
   */
  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  /**
   * Data da última atualização.
   */
  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
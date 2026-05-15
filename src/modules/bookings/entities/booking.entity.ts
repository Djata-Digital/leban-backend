import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Trip } from '../../trips/entities/trip.entity';
import { User } from '../../users/entities/user.entity';
import { BoardingPoint } from '../../boarding-points/entities/boarding-point.entity';

export enum BookingStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'booking_code',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  bookingCode: string;

  @ManyToOne(() => Trip, { eager: true })
  trip: Trip;

  @ManyToOne(() => User, { eager: true })
  buyer: User;

  @ManyToOne(() => User, {
    eager: true,
    nullable: true,
  })
  seller?: User | null;

  @Column({
    name: 'passenger_name',
    type: 'varchar',
    length: 150,
  })
  passengerName: string;

  @Column({
    name: 'passenger_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  passengerPhone?: string | null;

  @Column({
    name: 'pickup_location',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pickupLocation?: string | null;

  @ManyToOne(() => BoardingPoint, {
    eager: true,
    nullable: true,
  })
  boardingPoint?: BoardingPoint | null;

  @Column({
    name: 'boarding_point_order',
    type: 'int',
    nullable: true,
  })
  boardingPointOrder?: number | null;

  @ManyToOne(() => BoardingPoint, {
    eager: true,
    nullable: true,
  })
  dropoffPoint?: BoardingPoint | null;

  @Column({
    name: 'dropoff_point_order',
    type: 'int',
    nullable: true,
  })
  dropoffPointOrder?: number | null;

  @Column({
    name: 'seat_quantity',
    type: 'int',
    default: 1,
  })
  seatQuantity: number;

  @Column({
    name: 'ticket_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  ticketAmount: number;

  @Column({
    name: 'system_fee_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  systemFeeAmount: number;

  @Column({
    name: 'gross_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  grossAmount: number;

  @Column({
    name: 'owner_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  ownerAmount: number;

  @Column({
    name: 'seller_commission_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sellerCommissionAmount: number;

  @Column({
    name: 'subtotal_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  subtotalAmount: number;

  @Column({
    name: 'cargo_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  cargoAmount: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  totalAmount: number;

  @Column({
    name: 'commission_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  commissionRate: number;

  @Column({
    name: 'commission_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  commissionAmount: number;

  @Column({
    name: 'company_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  companyAmount: number;

  @Column({
    name: 'booking_status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  bookingStatus: BookingStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
  })
  expiresAt?: Date | null;

  @Column({
    name: 'confirmed_at',
    type: 'timestamp',
    nullable: true,
  })
  confirmedAt?: Date | null;

  @Column({
    name: 'boarded_at',
    type: 'timestamp',
    nullable: true,
  })
  boardedAt?: Date | null;

  @Column({
    name: 'arrived_at',
    type: 'timestamp',
    nullable: true,
  })
  arrivedAt?: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'timestamp',
    nullable: true,
  })
  cancelledAt?: Date | null;

  /**
   * Quando preenchido, a viagem some apenas do app do passageiro.
   * Admin, seller e banco de dados continuam mantendo o histórico.
   */
  @Column({
    name: 'passenger_deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  passengerDeletedAt?: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
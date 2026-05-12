import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { User } from '../../users/entities/user.entity';

export enum TripStatus {
  SCHEDULED = 'scheduled',
  BOARDING = 'boarding',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum DepartureMode {
  SCHEDULED_TIME = 'scheduled_time',
  WHEN_FULL = 'when_full',
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Route, { eager: true })
  route: Route;

  @ManyToOne(() => Vehicle, { eager: true })
  vehicle: Vehicle;

  @ManyToOne(() => User, { eager: true, nullable: true })
  driver?: User | null;

  @Column({
    name: 'departure_mode',
    type: 'enum',
    enum: DepartureMode,
    default: DepartureMode.SCHEDULED_TIME,
  })
  departureMode: DepartureMode;

  @Column({ name: 'boarding_date', type: 'date', nullable: true })
  boardingDate?: string | null;

  @Column({ name: 'departure_datetime', type: 'timestamp', nullable: true })
  departureDatetime?: Date | null;

  @Column({ name: 'estimated_arrival_datetime', type: 'timestamp', nullable: true })
  estimatedArrivalDatetime?: Date | null;

  @Column({ name: 'base_fare', type: 'numeric', precision: 12, scale: 2 })
  baseFare: number;

  @Column({ name: 'available_seats_count', type: 'int' })
  availableSeatsCount: number;

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.SCHEDULED,
  })
  status: TripStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}